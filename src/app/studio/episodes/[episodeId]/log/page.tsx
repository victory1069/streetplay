import type { Metadata } from "next";
import { EpisodeLogScreen } from "@/components/episode-after/episode-log";

export const metadata: Metadata = { title: "Episode log" };

export default async function StudioEpisodesEpisodeIdLogPage({ params }: PageProps<"/studio/episodes/[episodeId]/log">) {
  const { episodeId } = await params;
  return <EpisodeLogScreen episodeId={episodeId} />;
}
