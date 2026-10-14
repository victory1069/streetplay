import { getUserId } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentsProvider } from "@/lib/payments";
import { PAYOUT_FEE, sendWithdrawal } from "@/lib/payouts/server";
import { badRequest, dbError, readJson, unauthorized } from "@/lib/server/http";
import type { Withdrawal } from "@/types/domain";

// Sends money back to the creator's verified return account (wallet screen,
// or "Withdraw to GTBank ••89" when wrapping an episode).
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  // { max: true } withdraws everything free (minus the transfer fee), capped
  // at `amount` if given: used for "withdraw the leftover" after a wrap.
  const body = await readJson<{ amount: number; episodeId: string; max: boolean }>(request);
  const admin = createAdminClient();
  const provider = getPaymentsProvider();

  let amount = body.amount;
  if (body.max) {
    const { data: rows, error } = await admin.rpc("wallet_summary", { p_creator: userId });
    if (error) return dbError(error);
    const free = Number((rows as { free: number }[])[0]?.free ?? 0);
    amount = Math.min(Number.isInteger(body.amount) && body.amount! > 0 ? body.amount! : Infinity, free) - PAYOUT_FEE;
    if (!(amount > 0)) return badRequest("There's nothing free to withdraw.");
  }
  if (!Number.isInteger(amount) || amount! <= 0) return badRequest("Enter an amount.");
  const { data, error } = await admin.rpc("create_withdrawal", {
    p_user: userId,
    p_amount: amount,
    p_fee: PAYOUT_FEE,
    p_episode: body.episodeId ?? null,
    p_require_kyc: provider.movesRealMoney,
  });
  if (error) return dbError(error);
  return Response.json(await sendWithdrawal(admin, provider, data as Withdrawal));
}
