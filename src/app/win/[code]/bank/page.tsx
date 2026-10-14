import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getClaimView } from "@/lib/data/public";
import { WinBank } from "@/components/viewer/win-claim";
import { NoPrize } from "@/components/viewer/no-prize";

export const metadata: Metadata = { title: "Claim your prize", robots: { index: false } };

export default async function WinBankPage({ params }: PageProps<"/win/[code]/bank">) {
  const { code } = await params;
  const view = await getClaimView(code);
  if (!view) return <NoPrize />;
  if (view.status !== "held") redirect(`/win/${view.code}`);
  return <WinBank view={view} />;
}
