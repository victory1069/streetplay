import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

export const metadata: Metadata = { title: "Sponsor dashboard" };

export default function SponsorPage() {
  return (
    <ScreenPlaceholder
      title="Sponsor dashboard"
      surface="sponsor"
      notes={[
        "V3 · Fund prize pools",
        "Reach, game-page joins, votes, people paid, total paid, branded moments"
      ]}
    />
  );
}
