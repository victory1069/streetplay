import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentsProvider, PaymentsError } from "@/lib/payments";
import { activateWallet } from "@/lib/server/kyc";
import { badRequest, dbError, fail, rateLimit, readJson, tooMany, unauthorized } from "@/lib/server/http";

// "Open your wallet" (4 steps). The licensed partner runs the real checks;
// we keep the last 4 BVN digits and the selfie for audit, never the full BVN.
//   { step: "bvn", bvn }
//   { step: "return-account", accountNumber, bankCode }
// Final step (selfie + BVN again) is multipart: see ./submit/route.ts.
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return unauthorized();
  if (!(await rateLimit(`kyc:${user.id}`, 20, 600))) return tooMany();

  const admin = createAdminClient();
  const { data: creator } = await admin.from("creators").select("id, display_name, bvn_name").eq("id", user.id).maybeSingle();
  if (!creator) return dbError({ message: "not_owner" });

  const body = await readJson<{ step: string; bvn: string; accountNumber: string; bankCode: string }>(request);
  const provider = getPaymentsProvider();

  if (body.step === "bvn") {
    if (!/^\d{11}$/.test(body.bvn ?? "")) return badRequest("BVN is 11 digits.");
    // Partners confirm the BVN against the return account later; the mock
    // shows the creator's own name so the screen can be tested.
    const name = provider.movesRealMoney ? null : creator.display_name.toUpperCase();
    await admin.from("creators").update({ bvn_last4: body.bvn!.slice(-4), bvn_name: name }).eq("id", user.id);
    return Response.json({ last4: body.bvn!.slice(-4), first3: body.bvn!.slice(0, 3), name });
  }

  if (body.step === "return-account") {
    if (!/^\d{10}$/.test(body.accountNumber ?? "")) return badRequest("Account number must be 10 digits.");
    if (!body.bankCode) return badRequest("Pick your bank.");
    try {
      const { accountName } = await provider.nameEnquiry(body.accountNumber!, body.bankCode);
      await admin
        .from("creators")
        .update({ return_account_number: body.accountNumber, return_bank_code: body.bankCode, return_account_name: accountName })
        .eq("id", user.id);
      return Response.json({ accountName });
    } catch (err) {
      const retryable = err instanceof PaymentsError && err.retryable;
      return fail(retryable ? 503 : 422, "name_enquiry_failed", retryable ? "Bank lookup is down. Try again." : "Couldn't find that account.");
    }
  }

  return badRequest("Unknown step.");
}

/** Re-check: activates the wallet if the partner verified the creator already. */
export async function PUT() {
  const user = await getUser();
  if (!user) return unauthorized();
  const admin = createAdminClient();
  const { data: c } = await admin.from("creators").select("kyc_status").eq("id", user.id).maybeSingle();
  if (!c) return dbError({ message: "not_owner" });
  if (c.kyc_status === "verified") await activateWallet(admin, getPaymentsProvider(), user.id);
  return Response.json({ kyc_status: c.kyc_status });
}
