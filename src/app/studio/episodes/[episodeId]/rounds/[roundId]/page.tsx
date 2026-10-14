import type { Metadata } from "next";
import { Suspense } from "react";
import { RoundScreen } from "@/components/games/round-screen";

export const metadata: Metadata = { title: "Round" };

export default async function StudioRoundPage({ params }: PageProps<"/studio/episodes/[episodeId]/rounds/[roundId]">) {
  const { episodeId, roundId } = await params;
  return (
    <Suspense>
      <RoundScreen episodeId={episodeId} roundId={roundId} />
    </Suspense>
  );
}
