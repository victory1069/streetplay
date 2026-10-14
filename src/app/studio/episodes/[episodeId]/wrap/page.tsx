import type { Metadata } from "next";
import { WrapScreen } from "@/components/episode-after/wrap-screen";

export const metadata: Metadata = { title: "Wrap episode" };

export default async function StudioEpisodeWrapPage({ params }: PageProps<"/studio/episodes/[episodeId]/wrap">) {
  const { episodeId } = await params;
  return <WrapScreen episodeId={episodeId} />;
}
