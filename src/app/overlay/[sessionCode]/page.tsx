import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

export const metadata: Metadata = { title: "Stream overlay" };

export default async function OverlaySessionCodePage({ params }: PageProps<"/overlay/[sessionCode]">) {
  return (
    <ScreenPlaceholder
      title="Stream overlay"
      surface="overlay"
      params={await params}
      notes={[
        "V2 · OBS browser source for Live Producer streams",
        "Transparent background: vote bars, timer, leaderboard, sponsor logo"
      ]}
    />
  );
}
