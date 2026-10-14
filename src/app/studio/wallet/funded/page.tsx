import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { Funded } from "@/components/studio-setup/funded";

export const metadata: Metadata = { title: "Wallet funded" };

export default function FundedPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Funded />
    </Suspense>
  );
}
