import { getUserId } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentsProvider, PaymentsError } from "@/lib/payments";
import { PAYOUT_FEE, sendPayout, smsClaimCode } from "@/lib/payouts/server";
import { badRequest, dbError, fail, readJson, unauthorized } from "@/lib/server/http";
import { sendSms, smsText } from "@/lib/server/sms";
import { normalizePhone, recipientDisplay, titleCase } from "@/lib/format";
import type { AccountRequest, Payout, PayoutDraft } from "@/types/domain";

// Create and send a payout. Safe to retry with the same Idempotency-Key: a
// repeat returns the existing payout (and resumes sending if it stalled).
// Three ways to say who gets paid:
//   account_number + bank_code   host typed it (keypad screen)
//   account_request_token        participant typed it via the QR page
//   hold + recipient_phone       no bank account: SMS a claim code
//
// 200 final · 201 held · 202 still sending · 4xx refused
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const key = request.headers.get("Idempotency-Key");
  const draft = await readJson<PayoutDraft>(request);
  if (!key || draft.idempotency_key !== key) return badRequest("Idempotency-Key header must match the body.");
  if (!draft.episode_id) return badRequest("episode_id is required.");
  if (!Number.isInteger(draft.amount) || draft.amount! <= 0) return badRequest("Enter an amount.");

  const admin = createAdminClient();
  const provider = getPaymentsProvider();

  const { data: existing } = await admin.from("payouts").select("*").eq("idempotency_key", key).maybeSingle<Payout>();
  if (existing) {
    if (existing.creator_id !== userId) return dbError({ message: "not_owner" });
    return respond(await sendPayout(admin, provider, existing));
  }

  const base = {
    idempotency_key: key,
    episode_id: draft.episode_id,
    round_id: draft.round_id ?? null,
    amount: draft.amount,
    fee: PAYOUT_FEE,
  };

  // Bankless winner: hold the money and text them a claim code.
  if (draft.hold) {
    const phone = normalizePhone(draft.recipient_phone ?? "");
    if (!phone) return badRequest("Enter a valid Nigerian phone number.");
    const code = smsClaimCode();
    const { data, error } = await admin.rpc("create_payout", {
      p_user: userId,
      p: {
        ...base,
        hold: true,
        claim_code: code,
        claim_hours: 24 * 7,
        recipient_phone: phone,
        recipient_display: draft.participant_name ? titleCase(draft.participant_name.split(/\s+/)[0]) : null,
      },
      p_require_kyc: provider.movesRealMoney,
    });
    if (error) return dbError(error);
    const payout = data as Payout;
    const { data: creator } = await admin.from("creators").select("instagram_handle").eq("id", payout.creator_id).single();
    await sendSms(phone, smsText.claimCode({ amount: payout.amount, handle: creator?.instagram_handle, code, expires: payout.claim_expires_at! }));
    return Response.json(payout, { status: 201 });
  }

  let accountNumber: string;
  let bankCode: string;
  let accountName: string;
  let phone: string | null = draft.recipient_phone ? normalizePhone(draft.recipient_phone) : null;
  let participantName = draft.participant_name ?? null;

  if (draft.account_request_token) {
    const { data: req } = await admin
      .from("account_requests")
      .select("*")
      .eq("token", draft.account_request_token)
      .eq("episode_id", draft.episode_id)
      .maybeSingle<AccountRequest>();
    // "paid" is fine again once that earlier payout failed and was refunded ("Try again").
    let usable = req?.status === "confirmed";
    if (req?.status === "paid" && req.payout_id) {
      const { data: prev } = await admin.from("payouts").select("status").eq("id", req.payout_id).maybeSingle();
      usable = ["failed", "rejected", "reversed", "expired"].includes(prev?.status ?? "");
    }
    if (!req || !usable || !req.account_number || !req.bank_code || !req.account_name) {
      return fail(409, "not_confirmed", "The winner hasn't confirmed their account yet.");
    }
    accountNumber = req.account_number;
    bankCode = req.bank_code;
    accountName = req.account_name;
    phone = phone ?? req.phone;
    participantName = participantName ?? req.participant_name;
  } else {
    if (!/^\d{10}$/.test(draft.account_number ?? "")) return badRequest("Account number must be 10 digits.");
    if (!draft.bank_code) return badRequest("Pick a bank.");
    accountNumber = draft.account_number!;
    bankCode = draft.bank_code;
    // The server resolves the name itself; the client's copy is never trusted.
    try {
      accountName = (await provider.nameEnquiry(accountNumber, bankCode)).accountName;
    } catch (err) {
      const retryable = err instanceof PaymentsError && err.retryable;
      return fail(retryable ? 503 : 422, "name_enquiry_failed", retryable ? "Bank lookup is down. Try again." : "Couldn't find that account.");
    }
  }

  const { data, error } = await admin.rpc("create_payout", {
    p_user: userId,
    p: {
      ...base,
      account_number: accountNumber,
      bank_code: bankCode,
      account_name: accountName,
      recipient_display: recipientDisplay(participantName, accountName),
      recipient_phone: phone,
      account_request_token: draft.account_request_token ?? null,
    },
    p_require_kyc: provider.movesRealMoney,
  });
  if (error) return dbError(error);

  return respond(await sendPayout(admin, provider, data as Payout));
}

function respond(payout: Payout): Response {
  const settled = ["sent", "failed", "rejected", "expired"].includes(payout.status);
  return Response.json(payout, { status: settled ? 200 : payout.status === "held" ? 201 : 202 });
}
