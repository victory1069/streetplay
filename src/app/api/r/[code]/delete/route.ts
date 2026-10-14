import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, clientIp, dbError, fail, rateLimit, readJson, tooMany } from "@/lib/server/http";
import { sendSms, smsText } from "@/lib/server/sms";
import { maskPhone } from "@/lib/format";

// "Delete my details" from the receipt page (Nigeria Data Protection Act).
// Proof of ownership: a code texted to the winner's phone, or, when we never
// had a phone, the winner's own account number.
//   { action: "request" }                 → { method: "sms", phone } | { method: "account" }
//   { action: "confirm", code | accountNumber }
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

export async function POST(request: Request, { params }: RouteContext<"/api/r/[code]/delete">) {
  const { code } = await params;
  const receipt = code.toUpperCase();
  if (!(await rateLimit(`delete:${clientIp(request)}`, 10, 900))) return tooMany();

  const body = await readJson<{ action: "request" | "confirm"; code: string; accountNumber: string }>(request);
  const admin = createAdminClient();
  const { data: payout } = await admin
    .from("payouts")
    .select("receipt_code, recipient_phone, account_number, anonymized_at")
    .eq("receipt_code", receipt)
    .maybeSingle();
  if (!payout) return dbError({ message: "receipt_not_found" });
  if (payout.anonymized_at) return Response.json({ deleted: true });

  if (body.action === "request") {
    if (!payout.recipient_phone) return Response.json({ method: "account" });
    const otp = String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000));
    await admin.from("deletion_codes").upsert({
      receipt_code: receipt,
      code_hash: hash(otp),
      attempts: 0,
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
    await sendSms(payout.recipient_phone, smsText.deleteCode({ code: otp, receipt }));
    return Response.json({ method: "sms", phone: maskPhone(payout.recipient_phone) });
  }

  if (body.action !== "confirm") return badRequest("Unknown action.");

  if (payout.recipient_phone) {
    const { data: dc } = await admin.from("deletion_codes").select("*").eq("receipt_code", receipt).maybeSingle();
    if (!dc || new Date(dc.expires_at) < new Date()) return fail(410, "code_expired", "That code expired. Ask for a new one.");
    if (dc.attempts >= 5) return fail(429, "too_many_attempts", "Too many wrong codes. Ask for a new one.");
    if (hash(body.code ?? "") !== dc.code_hash) {
      await admin.from("deletion_codes").update({ attempts: dc.attempts + 1 }).eq("receipt_code", receipt);
      return fail(403, "wrong_code", "That code isn't right.");
    }
  } else if (!body.accountNumber || body.accountNumber !== payout.account_number) {
    return fail(403, "wrong_account", "That account number doesn't match this receipt.");
  }

  const { error } = await admin.rpc("anonymize_payout", { p_receipt_code: receipt });
  if (error) return dbError(error);
  await admin.from("deletion_codes").delete().eq("receipt_code", receipt);
  return Response.json({ deleted: true });
}
