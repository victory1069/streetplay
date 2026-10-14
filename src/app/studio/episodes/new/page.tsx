import type { Metadata } from "next";
import { NewEpisode } from "@/components/studio-setup/new-episode";

export const metadata: Metadata = { title: "New episode" };

export default function StudioEpisodesNewPage() {
  return <NewEpisode />;
}
