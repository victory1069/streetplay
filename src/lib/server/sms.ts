import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatNaira } from "@/lib/money";
import { appHost, dateWAT, receiptLabel } from "@/lib/format";

// SMS for people who never install anything: receipts, claim codes and
// delete-my-data codes. SMS_PROVIDER=mock (default) only logs to the
// sms_log table and the server console. SMS_PROVIDER=termii sends for real.
//
// Plain ASCII on purpose ("N20,000", not "₦"): basic phones and some
// networks mangle Unicode SMS, and it doubles the cost.

export async function sendSms(to: string, body: string): Promise<boolean> {
  const provider = process.env.SMS_PROVIDER ?? "mock";
  let status = "sent";
  let error: string | null = null;

  try {
    if (provider === "termii") await sendTermii(to, body);
    else console.info(`[sms:mock] to ${to}: ${body}`);
  } catch (err) {
    status = "failed";
    error = (err as Error).message;
    console.error("SMS failed", error);
  }

  await createAdminClient().from("sms_log").insert({ to_phone: to, body, provider, status, error });
  return status === "sent";
}

async function sendTermii(to: string, body: string) {
  const key = process.env.TERMII_API_KEY;
  if (!key) throw new Error("TERMII_API_KEY is not set");
  const res = await fetch(`${process.env.TERMII_BASE_URL ?? "https://v3.api.termii.com"}/api/sms/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      to,
      from: process.env.TERMII_SENDER_ID ?? "StreetPlay",
      sms: body,
      type: "plain",
      channel: "generic",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Termii ${res.status}: ${await res.text()}`);
}

const ascii = (kobo: number) => formatNaira(kobo).replace("₦", "N");
const handle = (h: string | null | undefined) => (h ? `@${h}` : "StreetPlay");

export const smsText = {
  receipt: (p: { amount: number; handle: string | null; bankName: string; last4: string; accountName: string; code: string }) =>
    `You won ${ascii(p.amount)} from ${handle(p.handle)}. Sent to ${p.bankName} ****${p.last4} ${p.accountName}. ` +
    `Receipt ${receiptLabel(p.code)} ${appHost()}/r/${p.code}`,

  airtime: (p: { amount: number; handle: string | null; code: string }) =>
    `You won ${ascii(p.amount)} airtime from ${handle(p.handle)}. Receipt ${receiptLabel(p.code)} ${appHost()}/r/${p.code}`,

  claimCode: (p: { amount: number; handle: string | null; code: string; expires: string }) =>
    `${ascii(p.amount)} from ${handle(p.handle)} is waiting for you. CODE ${p.code.slice(0, 3)} ${p.code.slice(3)}. ` +
    `Claim by ${dateWAT(p.expires)} at ${appHost()}/claim` +
    (process.env.SUPPORT_PHONE ? ` or call ${process.env.SUPPORT_PHONE}.` : "."),

  deleteCode: (p: { code: string; receipt: string }) =>
    `Your StreetPlay code to delete your details for receipt ${receiptLabel(p.receipt)} is ${p.code}. Ignore this if you didn't ask.`,

  viewerPrize: (p: { amount: number; handle: string | null; code: string }) =>
    `You won ${ascii(p.amount)} on ${handle(p.handle)}'s Live! Claim within 24 hours: ${appHost()}/win/${p.code}`,
};
