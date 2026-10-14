import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PaymentsError, type PaymentEvent, type PaymentsProvider, type TransferResult } from "./types";

// Paystack (https://paystack.com/docs/api). Before going live:
// - Transfers need a registered business with Transfers enabled.
// - Turn OFF "Confirm transfers before sending" (OTP) in Settings → Preferences.
// - Dedicated virtual accounts must be enabled on your Paystack account.
// - Webhook URL: https://<your-domain>/api/webhooks/paystack
// - Paystack has no airtime API: viewer airtime prizes need a VTU provider.

const BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set.");
  return key;
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new PaymentsError(`Paystack unreachable: ${(err as Error).message}`, true);
  }
  const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !body?.status) {
    throw new PaymentsError(body?.message ?? `Paystack error ${res.status}`, res.status >= 500 || res.status === 429);
  }
  return body.data as T;
}

function mapTransferStatus(status: string, reason?: string): TransferResult {
  switch (status) {
    case "success":
      return { status: "sent" };
    case "failed":
    case "abandoned":
    case "blocked":
    case "rejected":
      return { status: "failed", failureReason: reason ?? status };
    case "reversed":
      return { status: "failed", failureReason: "reversed" };
    case "otp":
      throw new PaymentsError("Paystack transfer OTP is on. Disable it in Paystack settings.", false);
    default: // pending, queued, received, processing
      return { status: "pending" };
  }
}

export const paystackProvider: PaymentsProvider = {
  name: "paystack",
  movesRealMoney: true,

  async listBanks() {
    const banks = await call<{ name: string; code: string; active: boolean }[]>("/bank?country=nigeria&currency=NGN");
    return banks.filter((b) => b.active).map(({ name, code }) => ({ name, code }));
  },

  async nameEnquiry(accountNumber, bankCode) {
    const data = await call<{ account_number: string; account_name: string }>(
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    );
    return { accountNumber: data.account_number, bankCode, accountName: data.account_name };
  },

  async transfer(req) {
    const recipient = await call<{ recipient_code: string }>("/transferrecipient", {
      method: "POST",
      body: { type: "nuban", name: req.accountName, account_number: req.accountNumber, bank_code: req.bankCode, currency: "NGN" },
    });
    const data = await call<{ status: string; transfer_code: string }>("/transfer", {
      method: "POST",
      body: {
        source: "balance",
        amount: req.amount,
        recipient: recipient.recipient_code,
        reference: req.reference,
        reason: req.narration,
        currency: "NGN",
      },
    });
    return { ...mapTransferStatus(data.status), providerReference: data.transfer_code };
  },

  async verifyTransfer(reference) {
    try {
      const data = await call<{ status: string; transfer_code: string; reason?: string }>(
        `/transfer/verify/${encodeURIComponent(reference)}`,
      );
      return { ...mapTransferStatus(data.status, data.reason), providerReference: data.transfer_code };
    } catch (err) {
      if (err instanceof PaymentsError && !err.retryable) return null;
      throw err;
    }
  },

  async createCustomer(input) {
    const data = await call<{ customer_code: string }>("/customer", {
      method: "POST",
      body: {
        email: input.email,
        first_name: input.firstName,
        last_name: input.lastName,
        phone: `+${input.phone}`,
        metadata: { creator_id: input.creatorId },
      },
    });
    return data.customer_code;
  },

  async verifyIdentity(req) {
    await call(`/customer/${encodeURIComponent(req.customerCode)}/identification`, {
      method: "POST",
      body: {
        country: "NG",
        type: "bank_account",
        account_number: req.accountNumber,
        bvn: req.bvn,
        bank_code: req.bankCode,
        first_name: req.firstName,
        last_name: req.lastName,
      },
    });
    return "pending";
  },

  async createVirtualAccount(customerCode) {
    const data = await call<{ account_number: string; account_name: string; bank: { name: string } }>("/dedicated_account", {
      method: "POST",
      body: { customer: customerCode, preferred_bank: process.env.PAYSTACK_DVA_BANK ?? "wema-bank" },
    });
    return { customerCode, accountNumber: data.account_number, bankName: data.bank.name, accountName: data.account_name };
  },

  async initializeCheckout(req) {
    const data = await call<{ authorization_url: string }>("/transaction/initialize", {
      method: "POST",
      body: {
        email: req.email,
        amount: req.amount,
        reference: req.reference,
        callback_url: req.callbackUrl,
        currency: "NGN",
        metadata: req.metadata,
      },
    });
    return { url: data.authorization_url };
  },

  async parseWebhook(rawBody, headers): Promise<PaymentEvent> {
    const signature = headers.get("x-paystack-signature") ?? "";
    const expected = createHmac("sha512", secretKey()).update(rawBody).digest("hex");
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new PaymentsError("Bad webhook signature", false);
    }

    const event = JSON.parse(rawBody) as {
      event: string;
      data: {
        reference: string;
        amount: number;
        fees?: number | null;
        reason?: string;
        channel?: string;
        customer_code?: string;
        customer?: { customer_code?: string };
        authorization?: { sender_name?: string; sender_bank?: string };
        metadata?: { kind?: string; creator_id?: string; episode_id?: string; sponsor_name?: string } | null;
      };
    };
    const d = event.data;
    const net = d.amount - (d.fees ?? 0);

    switch (event.event) {
      case "charge.success":
        if (d.channel === "dedicated_nuban" && d.customer?.customer_code) {
          const sender = [d.authorization?.sender_name, d.authorization?.sender_bank].filter(Boolean).join(" · ") || null;
          return { type: "funding", reference: d.reference, customerCode: d.customer.customer_code, amount: net, sender };
        }
        if (d.metadata?.kind === "sponsor" && d.metadata.creator_id && d.metadata.episode_id) {
          return {
            type: "sponsor",
            reference: d.reference,
            creatorId: d.metadata.creator_id,
            episodeId: d.metadata.episode_id,
            sponsorName: d.metadata.sponsor_name ?? "Sponsor",
            amount: net,
          };
        }
        return { type: "ignored" };
      case "transfer.success":
        return { type: "transfer.result", reference: d.reference, status: "sent" };
      case "transfer.failed":
        return { type: "transfer.result", reference: d.reference, status: "failed", reason: d.reason };
      case "transfer.reversed":
        return { type: "transfer.result", reference: d.reference, status: "reversed", reason: d.reason };
      case "customeridentification.success":
        return { type: "identity.result", customerCode: d.customer_code ?? "", verified: true };
      case "customeridentification.failed":
        return { type: "identity.result", customerCode: d.customer_code ?? "", verified: false, reason: d.reason };
      default:
        return { type: "ignored" };
    }
  },
};
