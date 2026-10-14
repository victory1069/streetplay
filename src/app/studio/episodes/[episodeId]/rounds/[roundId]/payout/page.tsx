import type { Metadata } from "next";
import { Suspense } from "react";
import { PayoutFlow } from "@/components/payout/payout-flow";

export const metadata: Metadata = { title: "Pay the winner" };

export default async function StudioPayoutPage({ params }: PageProps<"/studio/episodes/[episodeId]/rounds/[roundId]/payout">) {
  const { episodeId, roundId } = await params;
  return (
    <Suspense>
      <PayoutFlow episodeId={episodeId} roundId={roundId} />
    </Suspense>
  );
}
