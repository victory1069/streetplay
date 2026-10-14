import { cookies } from "next/headers";
import { findOrCreateUser } from "@/lib/demo/db";
import { SESSION_COOKIE, isDemo } from "@/lib/demo/types";
import { normalizePhone } from "@/lib/format";

// Local mode only: stands in for Supabase phone auth. There's no SMS, so
// the one-time code is fixed (DEMO_OTP, default 123456). A new number gets
// a new account and goes through onboarding like any real user.
export async function POST(request: Request) {
  if (!isDemo()) return new Response("Not found", { status: 404 });
  const { phone: raw, token } = (await request.json().catch(() => ({}))) as { phone?: string; token?: string };
  const phone = normalizePhone(raw ?? "");
  if (!phone) return Response.json({ message: "Enter a valid Nigerian phone number." }, { status: 400 });
  if ((token ?? "").trim() !== (process.env.DEMO_OTP ?? "123456")) {
    return Response.json({ message: "Token has expired or is invalid" }, { status: 400 });
  }
  const id = await findOrCreateUser(phone);
  (await cookies()).set(SESSION_COOKIE, `${id}~${phone}`, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  return Response.json({ ok: true });
}

export async function DELETE() {
  if (!isDemo()) return new Response("Not found", { status: 404 });
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
