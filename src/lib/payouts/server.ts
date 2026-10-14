import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PaymentsError, type PaymentsProvider, type TransferResult } from "@/lib/payments";
import { sendSms, smsText } from "@/lib/server/sms";
import type { Payout, Withdrawal } from "@/types/domain";

/** Flat fee per transfer, passed through at cost (spec § Monetization). */
export const PAYOUT_FEE: number = Number(process.env.PAYOUT_FEE_KOBO ?? 5000);

/**
 * Sends a payout that is in "sending" state and records the result.
 * Always asks the provider first whether this reference was already sent:
 * a repeat request (two tabs flushing the same outbox key,
 * a retry after a timeout) can arrive while the first transfer is in flight,
 * and must never send twice or be marked failed.
 */
export async function sendPayout(
  admin: SupabaseClient,
  provider: PaymentsProvider,
  payout: Payout,
): Promise<Payout> {
  if (payout.status !== "sending") return payout;

  let result: TransferResult;
  try {
    const prior = await provider.verifyTransfer(payout.id);
    if (prior) result = prior;
    else if (payout.channel === "airtime") {
      if (!provider.airtime) throw new PaymentsError("Airtime isn't available yet.", false);
      result = await provider.airtime(payout.recipient_phone!, payout.amount, payout.id);
    } else {
      result = await provider.transfer({
        reference: payout.id,
        amount: payout.amount,
        accountNumber: payout.account_number!,
        bankCode: payout.bank_code!,
        accountName: payout.account_name ?? "",
        narration: "StreetPlay prize",
      });
    }
  } catch (err) {
    // Outcome unknown (timeout, provider down), or the provider says this
    // reference was already used (a concurrent send): leave it "sending".
    // The webhook or the next retry settles it. Funds stay reserved.
    if (err instanceof PaymentsError && (err.retryable || isDuplicateReference(err))) return payout;
    result = { status: "failed", failureReason: (err as Error).message };
  }

  const { data, error } = await admin.rpc("mark_payout_result", {
    p_payout: payout.id,
    p_status: result.status === "pending" ? "sending" : result.status,
    p_provider_reference: result.providerReference ?? null,
    p_failure_reason: result.failureReason ?? null,
  });
  if (error) throw error;
  const updated = data as Payout;
  if (updated.status === "sent") await notifyPayoutSent(admin, provider, updated);
  return updated;
}

/** SMS receipt to the winner, when we have their number. Never throws. */
export async function notifyPayoutSent(admin: SupabaseClient, provider: PaymentsProvider, payout: Payout): Promise<void> {
  if (!payout.recipient_phone) return;
  try {
    const { data: creator } = await admin.from("creators").select("instagram_handle").eq("id", payout.creator_id).single();
    const handle = creator?.instagram_handle ?? null;
    if (payout.channel === "airtime") {
      await sendSms(payout.recipient_phone, smsText.airtime({ amount: payout.amount, handle, code: payout.receipt_code }));
      return;
    }
    const banks = await provider.listBanks().catch(() => []);
    await sendSms(
      payout.recipient_phone,
      smsText.receipt({
        amount: payout.amount,
        handle,
        bankName: banks.find((b) => b.code === payout.bank_code)?.name ?? "your bank",
        last4: payout.account_number?.slice(-4) ?? "",
        accountName: payout.account_name ?? "",
        code: payout.receipt_code,
      }),
    );
  } catch (err) {
    console.error("receipt SMS failed", err);
  }
}

function isDuplicateReference(err: Error): boolean {
  return /duplicate|already (been )?(used|exists)/i.test(err.message);
}

export async function sendWithdrawal(admin: SupabaseClient, provider: PaymentsProvider, w: Withdrawal): Promise<Withdrawal> {
  let result: TransferResult;
  try {
    result = await provider.transfer({
      reference: `wd_${w.id}`,
      amount: w.amount,
      accountNumber: w.account_number,
      bankCode: w.bank_code,
      accountName: w.account_name,
      narration: "StreetPlay withdrawal",
    });
  } catch (err) {
    if (err instanceof PaymentsError && err.retryable) return w;
    result = { status: "failed", failureReason: (err as Error).message };
  }
  const { data, error } = await admin.rpc("mark_withdrawal_result", {
    p_id: w.id,
    p_status: result.status === "pending" ? "sending" : result.status,
    p_provider_reference: result.providerReference ?? null,
    p_failure_reason: result.failureReason ?? null,
  });
  if (error) throw error;
  return data as Withdrawal;
}

/** 6-digit code for SMS claims ("482 913"). */
export function smsClaimCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 900_000;
  return String(100_000 + n);
}

/** Longer code for viewer prize links (/win/[code]). */
export function linkClaimCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => alphabet[b % 32]).join("");
}
