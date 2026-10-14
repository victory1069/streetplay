import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { Wallet } from "@/components/studio-setup/wallet";

export const metadata: Metadata = { title: "Wallet" };

export default function StudioWalletPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Wallet />
    </Suspense>
  );
}
