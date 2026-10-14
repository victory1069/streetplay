import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentsProvider, PaymentsError } from "@/lib/payments";
import { sendPayout } from "@/lib/payouts/server";
import { badRequest, clientIp, dbError, fail, rateLimit, readJson, tooMany } from "@/lib/server/http";
import { claimView } from "@/lib/server/views";
import { normalizePhone, recipientDisplay } from "@/lib/format";
import type { Payout } from "@/types/domain";

// Held prizes: bankless street winners (SMS code at /claim) and viewer prizes
// (/win/[code]). Codes are short, so lookups are rate limited per IP.

export async function GET(request: Request, { params }: RouteContext<"/api/claim/[code]">) {
  await connection();
  if (!(await rateLimit(`claim:get:${clientIp(request)}`, 20, 600))) return tooMany();
  const { code } = await params;
  const provider = getPaymentsProvider();
  const view = await claimView(createAdminClient(), code, Boolean(provider.airtime));
  return view ? Response.json(view) : fail(404, "bad_claim_code", "That code doesn't match any prize.");
}

/**
 * { check: true, accountNumber, bankCode } → name preview.
 * { channel: "bank", accountNumber, bankCode, phone? } or { channel: "airtime", phone } → claim and send.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/claim/[code]">) {
  const { code } = await params;
  if (!(await rateLimit(`claim:post:${clientIp(request)}`, 15, 600))) return tooMany();

  const body = await readJson<{ check: boolean; channel: "bank" | "airtime"; accountNumber: string; bankCode: string; phone: string }>(request);
  const admin = createAdminClient();
  const provider = getPaymentsProvider();

  const view = await claimView(admin, code, Boolean(provider.airtime));
  if (!view) return fail(404, "bad_claim_code", "That code doesn't match any prize.");
  if (view.status === "expired") return dbError({ message: "claim_expired" });
  if (view.status !== "held") return dbError({ message: "already_claimed" });

  const channel = body.channel ?? "bank";
  const phone = body.phone ? normalizePhone(body.phone) : null;
  if (body.phone && !phone) return badRequest("Enter a valid Nigerian phone number.");

  if (channel === "airtime") {
    if (!view.airtime_available) return badRequest("Airtime isn't available for this prize.");
    if (!phone) return badRequest("Enter the phone number to top up.");
    if (body.check) return Response.json({ ok: true });
    const { data, error } = await admin.rpc("claim_payout", {
      p_code: view.code, p_channel: "airtime", p_account_number: null, p_bank_code: null,
      p_account_name: null, p_recipient_display: view.recipient_display, p_phone: phone,
    });
    if (error) return dbError(error);
    if ((data as Payout).status === "expired") return dbError({ message: "claim_expired" });
    return Response.json(await sendPayout(admin, provider, data as Payout));
  }

  if (!/^\d{10}$/.test(body.accountNumber ?? "")) return badRequest("Account number must be 10 digits.");
  if (!body.bankCode) return badRequest("Pick your bank or wallet.");

  let accountName: string;
  try {
    accountName = (await provider.nameEnquiry(body.accountNumber!, body.bankCode)).accountName;
  } catch (err) {
    const retryable = err instanceof PaymentsError && err.retryable;
    return fail(retryable ? 503 : 422, "name_enquiry_failed", retryable ? "Bank lookup is down. Try again." : "We couldn't find that account. Check the number and bank.");
  }
  if (body.check) return Response.json({ accountName });

  const { data, error } = await admin.rpc("claim_payout", {
    p_code: view.code,
    p_channel: "bank",
    p_account_number: body.accountNumber,
    p_bank_code: body.bankCode,
    p_account_name: accountName,
    p_recipient_display: recipientDisplay(view.recipient_display, accountName),
    p_phone: phone,
  });
  if (error) return dbError(error);
  if ((data as Payout).status === "expired") return dbError({ message: "claim_expired" });
  return Response.json(await sendPayout(admin, provider, data as Payout));
}
