// Phone sign-in (first screen). Supabase sends the SMS code;
// configure an SMS provider in Supabase → Authentication → Phone, or add
// test numbers there while developing.

import { createClient } from "@/lib/supabase/client";
import { normalizePhone } from "@/lib/format";

export async function sendPhoneCode(input: string): Promise<string> {
  const phone = normalizePhone(input);
  if (!phone) throw new Error("Enter a valid Nigerian phone number.");
  const { error } = await createClient().auth.signInWithOtp({ phone: `+${phone}` });
  if (error) throw new Error(error.message);
  return phone;
}

export async function verifyPhoneCode(phone: string, code: string): Promise<void> {
  const { error } = await createClient().auth.verifyOtp({ phone: `+${phone}`, token: code, type: "sms" });
  if (error) throw new Error(error.message === "Token has expired or is invalid" ? "That code is wrong or expired." : error.message);
}

export { signOut } from "@/lib/supabase/sign-out";
