import type { Metadata } from "next";
import { QueuedScreen } from "@/components/payout/queued-screen";

export const metadata: Metadata = { title: "Queued payouts" };

export default async function StudioQueuedPage({ params }: PageProps<"/studio/episodes/[episodeId]/queued">) {
  const { episodeId } = await params;
  return <QueuedScreen episodeId={episodeId} />;
}
