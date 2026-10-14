import type { Metadata } from "next";
import { Suspense } from "react";
import { ClaimForm } from "@/components/participant/claim-form";
import { ClaimFromQuery } from "@/components/participant/claim-from-query";

export const metadata: Metadata = { title: "Claim your prize", robots: { index: false } };

export default function ClaimPage() {
  return (
    <Suspense fallback={<ClaimForm />}>
      <ClaimFromQuery />
    </Suspense>
  );
}
