import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, clientIp, fail, rateLimit, readJson, tooMany } from "@/lib/server/http";
import { currentFan, hashToken, issueFanToken } from "@/lib/live/viewer-auth";
import { fanStanding } from "@/lib/live/standing";

// "Join the game": display name only (spec: phone number only when claiming).
// Rejoining from the same browser keeps the fan and their points.
export async function POST(request: Request, { params }: RouteContext<"/api/live/[handle]/join">) {
  const { handle } = await params;
  if (!(await rateLimit(`join:${clientIp(request)}`, 20, 60))) return tooMany();

  const { displayName: raw } = await readJson<{ displayName: string }>(request);
  const displayName = raw?.trim().replace(/\s+/g, " ") ?? "";
  if (displayName.length < 1 || displayName.length > 24) return badRequest("Name must be 1–24 characters.");

  const admin = createAdminClient();
  const existing = await currentFan(admin, handle);
  let fanId: string;
  let episodeId: string | null;

  if (existing) {
    await admin.from("fans").update({ display_name: displayName, last_seen_at: new Date().toISOString() }).eq("id", existing.fan.id);
    fanId = existing.fan.id;
    episodeId = existing.session.status === "live" ? existing.session.episode_id : null;
  } else {
    const { data: rows } = await admin.rpc("live_session", { p_handle: handle });
    const session = (rows as { creator_id: string; episode_id: string | null; status: string | null }[] | null)?.[0];
    if (!session) return fail(404, "not_found", "We couldn't find that show.");
    const token = await issueFanToken(handle);
    const { data: fan, error } = await admin
      .from("fans")
      .insert({ creator_id: session.creator_id, display_name: displayName, token_hash: hashToken(token) })
      .select("id")
      .single();
    if (error) return fail(500, "server_error", "Couldn't join. Try again.");
    fanId = fan.id;
    episodeId = session.status === "live" ? session.episode_id : null;
  }

  if (episodeId) {
    await admin.from("fan_scores").upsert({ episode_id: episodeId, fan_id: fanId }, { onConflict: "episode_id,fan_id", ignoreDuplicates: true });
  }
  return Response.json(await fanStanding(admin, { id: fanId, display_name: displayName }, episodeId));
}
