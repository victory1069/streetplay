import type { Metadata } from "next";
import { Fund } from "@/components/studio-setup/fund";

export const metadata: Metadata = { title: "Fund wallet" };

export default function FundPage() {
  return <Fund />;
}
