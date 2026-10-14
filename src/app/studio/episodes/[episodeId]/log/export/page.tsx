import type { Metadata } from "next";
import { ExportScreen } from "@/components/episode-after/export-screen";

export const metadata: Metadata = { title: "Export" };

export default async function StudioEpisodeExportPage({ params }: PageProps<"/studio/episodes/[episodeId]/log/export">) {
  const { episodeId } = await params;
  return <ExportScreen episodeId={episodeId} />;
}
