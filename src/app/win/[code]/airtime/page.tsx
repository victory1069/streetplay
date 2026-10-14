import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getClaimView } from "@/lib/data/public";
import { WinAirtime } from "@/components/viewer/win-claim";
import { NoPrize } from "@/components/viewer/no-prize";

export const metadata: Metadata = { title: "Claim your prize", robots: { index: false } };

export default async function WinAirtimePage({ params }: PageProps<"/win/[code]/airtime">) {
  const { code } = await params;
  const view = await getClaimView(code);
  if (!view) return <NoPrize />;
  if (view.status !== "held" || !view.airtime_available) redirect(`/win/${view.code}`);
  return <WinAirtime view={view} />;
}
