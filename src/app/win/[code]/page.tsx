import type { Metadata } from "next";
import { getClaimView } from "@/lib/data/public";
import { WinChoose } from "@/components/viewer/win-choose";
import { NoPrize } from "@/components/viewer/no-prize";

export const metadata: Metadata = { title: "You don win", robots: { index: false } };

export default async function WinPage({ params }: PageProps<"/win/[code]">) {
  const { code } = await params;
  const view = await getClaimView(code);
  return view ? <WinChoose view={view} /> : <NoPrize />;
}
