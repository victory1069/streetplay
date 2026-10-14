import { getUserId } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentsProvider } from "@/lib/payments";
import { PAYOUT_FEE, linkClaimCode } from "@/lib/payouts/server";
import { badRequest, dbError, readJson, unauthorized } from "@/lib/server/http";
import type { Payout } from "@/types/domain";

// Host picks viewer winners from the leaderboard ("Top 3 win ₦5,000 each").
// Each gets a held prize with a /win/[code] link, visible on their board,
// claimable for 24 hours. Funds are reserved from the episode now.
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = await readJson<{ episodeId: string; amount: number; top: number }>(request);
  if (!body.episodeId) return badRequest("episodeId is required.");
  if (!Number.isInteger(body.amount) || body.amount! <= 0) return badRequest("Enter a prize amount.");
  const top = Math.min(Math.max(1, body.top ?? 3), 10);

  const admin = createAdminClient();
  const { data: board } = await admin
    .from("fan_scores")
    .select("fan_id, points, fan:fans(display_name)")
    .eq("episode_id", body.episodeId)
    .gt("points", 0)
    .order("points", { ascending: false })
    .order("joined_at", { ascending: true })
    .limit(top);

  const created: Payout[] = [];
  for (const [i, row] of ((board ?? []) as unknown as { fan_id: string; fan: { display_name: string } }[]).entries()) {
    const { data, error } = await admin.rpc("create_payout", {
      p_user: userId,
      p: {
        idempotency_key: `viewer-prize:${body.episodeId}:${row.fan_id}`,
        episode_id: body.episodeId,
        amount: body.amount,
        fee: PAYOUT_FEE,
        kind: "viewer",
        hold: true,
        claim_code: linkClaimCode(),
        claim_hours: 24,
        fan_id: row.fan_id,
        recipient_display: row.fan.display_name,
      },
      p_require_kyc: getPaymentsProvider().movesRealMoney,
    });
    if (error) return i === 0 ? dbError(error) : Response.json({ created, error: error.message }, { status: 207 });
    created.push(data as Payout);
  }
  return Response.json({ created });
}
