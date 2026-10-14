import { getUserId } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentsProvider } from "@/lib/payments";
import { badRequest, dbError, fail, readJson, unauthorized } from "@/lib/server/http";

// Mock provider only: pretend someone transferred into the creator's
// account number, so the Fund → "Wallet funded" flow can be tested.
// With a real provider the webhook does this.
export async function POST(request: Request) {
  if (getPaymentsProvider().movesRealMoney) return fail(404, "not_found", "Not found.");
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = await readJson<{ amount: number; sender: string }>(request);
  if (!Number.isInteger(body.amount) || body.amount! <= 0) return badRequest("Enter an amount.");

  const admin = createAdminClient();
  const { data: creator } = await admin.from("creators").select("id, default_episode_id, return_account_name, display_name").eq("id", userId).maybeSingle();
  if (!creator) return dbError({ message: "not_owner" });

  const reference = `sim_${crypto.randomUUID()}`;
  const { error } = await admin.rpc("record_funding", {
    p_creator: creator.id,
    p_amount: body.amount,
    p_reference: reference,
    p_kind: "topup",
    p_episode: creator.default_episode_id,
    p_counterparty: body.sender ?? `${(creator.return_account_name ?? creator.display_name).toUpperCase()} · GTBank`,
  });
  if (error) return dbError(error);
  return Response.json({ reference });
}
