import type { Metadata } from "next";
import { EpisodesList } from "@/components/studio-setup/episodes-list";

export const metadata: Metadata = { title: "Episodes" };

export default function EpisodesPage() {
  return <EpisodesList />;
}
