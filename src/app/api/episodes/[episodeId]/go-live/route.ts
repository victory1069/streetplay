import { createClient, getUserId } from "@/lib/supabase/server";
import { notifyFans } from "@/lib/server/push";
import { dbError, unauthorized } from "@/lib/server/http";
import { appUrl } from "@/lib/format";
import type { Episode } from "@/types/domain";

// Starts the episode (status → live) and pings fans who asked to be told.
// The update runs as the signed-in user, so RLS checks it's their episode.
export async function POST(_request: Request, { params }: RouteContext<"/api/episodes/[episodeId]/go-live">) {
  if (!(await getUserId())) return unauthorized();
  const { episodeId } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("episodes")
    .update({ status: "live" })
    .eq("id", episodeId)
    .neq("status", "wrapped")
    .select("*, creator:creators(display_name, instagram_handle)")
    .maybeSingle();
  if (error) return dbError(error);
  if (!data) return dbError({ message: "episode_not_found" });

  const ep = data as Episode & { creator: { display_name: string; instagram_handle: string | null } };
  if (ep.creator.instagram_handle) {
    await notifyFans(ep.creator_id, {
      title: `@${ep.creator.instagram_handle} is live`,
      body: `Ep ${ep.number} · ${ep.title}. Join the game, na free.`,
      url: appUrl(`/play/${ep.creator.instagram_handle}`),
    });
  }
  return Response.json(ep);
}
