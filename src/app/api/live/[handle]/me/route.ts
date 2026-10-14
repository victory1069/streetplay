import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail } from "@/lib/server/http";
import { currentFan } from "@/lib/live/viewer-auth";
import { fanStanding } from "@/lib/live/standing";

// The fan behind this browser: points, rank, streak, unclaimed prize.
// 401 means "show the join screen".
export async function GET(_request: Request, { params }: RouteContext<"/api/live/[handle]/me">) {
  await connection();
  const { handle } = await params;
  const admin = createAdminClient();
  const ctx = await currentFan(admin, handle);
  if (!ctx) return fail(401, "not_joined", "Join the game first.");

  const episodeId = ctx.session.episode_id;
  if (episodeId && ctx.session.status === "live") {
    await admin.from("fan_scores").upsert({ episode_id: episodeId, fan_id: ctx.fan.id }, { onConflict: "episode_id,fan_id", ignoreDuplicates: true });
  }
  await admin.from("fans").update({ last_seen_at: new Date().toISOString() }).eq("id", ctx.fan.id);
  return Response.json(await fanStanding(admin, ctx.fan, episodeId));
}
