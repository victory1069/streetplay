import { getUserId } from "@/lib/supabase/server";
import { getPaymentsProvider, PaymentsError } from "@/lib/payments";
import { badRequest, fail, rateLimit, readJson, tooMany, unauthorized } from "@/lib/server/http";

// Host-side name check: the account holder's name in huge type, read out on
// camera before Send. Signed-in hosts only, so the provider's lookup can't be scraped.
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  if (!(await rateLimit(`enquiry:${userId}`, 60, 60))) return tooMany();

  const body = await readJson<{ accountNumber: string; bankCode: string }>(request);
  if (!/^\d{10}$/.test(body.accountNumber ?? "")) return badRequest("Account number must be 10 digits.");
  if (!body.bankCode) return badRequest("Pick a bank.");

  try {
    return Response.json(await getPaymentsProvider().nameEnquiry(body.accountNumber!, body.bankCode));
  } catch (err) {
    const retryable = err instanceof PaymentsError && err.retryable;
    return fail(retryable ? 503 : 422, "name_enquiry_failed", retryable ? "Bank lookup is down. Try again." : "Couldn't find that account.");
  }
}
