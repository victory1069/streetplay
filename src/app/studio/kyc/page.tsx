import type { Metadata } from "next";
import { Kyc } from "@/components/studio-setup/kyc";

export const metadata: Metadata = { title: "Open your wallet" };

export default function KycPage() {
  return <Kyc />;
}
