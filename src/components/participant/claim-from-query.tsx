"use client";

import { useSearchParams } from "next/navigation";
import { ClaimForm } from "./claim-form";

/** /claim?code=482913 prefills the boxes (link in the SMS). */
export function ClaimFromQuery() {
  const code = useSearchParams().get("code") ?? "";
  return <ClaimForm key={code} initialCode={code} />;
}
