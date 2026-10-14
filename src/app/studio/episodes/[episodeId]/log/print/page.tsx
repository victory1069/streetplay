import type { Metadata } from "next";
import { PrintLog } from "@/components/episode-after/print-log";

export const metadata: Metadata = { title: "Episode log (print)" };

export default async function StudioEpisodePrintPage({ params }: PageProps<"/studio/episodes/[episodeId]/log/print">) {
  const { episodeId } = await params;
  return <PrintLog episodeId={episodeId} />;
}
