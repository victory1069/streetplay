import type { Metadata } from "next";
import { LivePanel } from "@/components/producer/live-panel";

export const metadata: Metadata = { title: "Live panel" };

export default async function StudioEpisodesEpisodeIdLivePage({ params }: PageProps<"/studio/episodes/[episodeId]/live">) {
  const { episodeId } = await params;
  return <LivePanel episodeId={episodeId} />;
}
