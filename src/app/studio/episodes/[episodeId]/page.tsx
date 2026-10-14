import type { Metadata } from "next";
import { EpisodeConsole } from "@/components/games/episode-console";

export const metadata: Metadata = { title: "Episode" };

export default async function StudioEpisodePage({ params }: PageProps<"/studio/episodes/[episodeId]">) {
  const { episodeId } = await params;
  return <EpisodeConsole episodeId={episodeId} />;
}
