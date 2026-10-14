import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FanStanding } from "@/types/domain";

/** Points, rank, streak and any unclaimed prize for one fan in one episode. */
export async function fanStanding(
  admin: SupabaseClient,
  fan: { id: string; display_name: string },
  episodeId: string | null,
): Promise<FanStanding> {
  if (!episodeId) {
    return { id: fan.id, display_name: fan.display_name, points: 0, rank: 0, streak: 0, correct: 0, answered: 0, prize: null };
  }
  const [{ data: score }, { data: rank }, { data: prize }] = await Promise.all([
    admin.from("fan_scores").select("*").eq("episode_id", episodeId).eq("fan_id", fan.id).maybeSingle(),
    admin.rpc("fan_rank", { p_episode: episodeId, p_fan: fan.id }),
    admin
      .from("payouts")
      .select("claim_code, amount, claim_expires_at")
      .eq("episode_id", episodeId)
      .eq("fan_id", fan.id)
      .eq("status", "held")
      .maybeSingle(),
  ]);
  return {
    id: fan.id,
    display_name: fan.display_name,
    points: score?.points ?? 0,
    rank: score ? Number(rank) : 0,
    streak: score?.streak ?? 0,
    correct: score?.correct ?? 0,
    answered: score?.answered ?? 0,
    prize: prize ? { code: prize.claim_code, amount: prize.amount, expires_at: prize.claim_expires_at } : null,
  };
}
