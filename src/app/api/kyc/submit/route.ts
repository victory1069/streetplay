import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentsProvider, PaymentsError } from "@/lib/payments";
import { activateWallet } from "@/lib/server/kyc";
import { badRequest, dbError, fail, rateLimit, tooMany, unauthorized } from "@/lib/server/http";

// Final KYC step: selfie + BVN (sent again, never stored in full). Uploads
// the selfie to the private "kyc" bucket and asks the partner to verify.
// Mock provider: verified immediately and the account number is issued.
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return unauthorized();
  if (!(await rateLimit(`kyc-submit:${user.id}`, 5, 600))) return tooMany();

  const form = await request.formData().catch(() => null);
  const bvn = String(form?.get("bvn") ?? "");
  const selfie = form?.get("selfie");
  if (!/^\d{11}$/.test(bvn)) return badRequest("BVN is 11 digits.");
  if (!(selfie instanceof File) || selfie.size === 0) return badRequest("Take a selfie first.");
  if (selfie.size > 6 * 1024 * 1024) return badRequest("That photo is too big. Try again.");

  const admin = createAdminClient();
  const { data: c } = await admin.from("creators").select("*").eq("id", user.id).maybeSingle();
  if (!c) return dbError({ message: "not_owner" });
  if (!c.return_account_number) return badRequest("Add your return account first.");

  const path = `${user.id}/selfie-${Date.now()}.jpg`;
  const { error: upErr } = await admin.storage.from("kyc").upload(path, selfie, { contentType: selfie.type || "image/jpeg" });
  if (upErr) return fail(500, "upload_failed", "Couldn't save the selfie. Try again.");

  const provider = getPaymentsProvider();
  const [firstName, ...rest] = (c.return_account_name ?? c.display_name).split(/\s+/);
  const lastName = rest.join(" ") || firstName;

  const phone = user.phone ?? c.phone ?? "";
  try {
    let customerCode: string = c.provider_customer_code;
    if (!customerCode) {
      customerCode = await provider.createCustomer({
        creatorId: user.id,
        firstName,
        lastName,
        phone,
        // Phone-only accounts have no email; partners require one.
        email: user.email ?? `${(phone || user.id).replace(/\W/g, "")}@creators.streetplay.ng`,
      });
    }
    await admin
      .from("creators")
      .update({
        selfie_path: path,
        phone: phone || null,
        provider_customer_code: customerCode,
        kyc_submitted_at: new Date().toISOString(),
        bvn_last4: bvn.slice(-4),
      })
      .eq("id", user.id);

    const status = await provider.verifyIdentity({
      customerCode,
      bvn,
      accountNumber: c.return_account_number,
      bankCode: c.return_bank_code,
      firstName,
      lastName,
    });
    if (status === "verified") await activateWallet(admin, provider, user.id);
    return Response.json({ kyc_status: status === "verified" ? "verified" : "pending" });
  } catch (err) {
    const retryable = err instanceof PaymentsError && err.retryable;
    return fail(retryable ? 503 : 422, "kyc_failed", retryable ? "Our partner is down. Try again shortly." : (err as Error).message);
  }
}
