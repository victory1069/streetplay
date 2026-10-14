import type { Metadata } from "next";
import { Packs } from "@/components/studio-setup/packs";

export const metadata: Metadata = { title: "Write your own" };

export default function PacksPage() {
  return <Packs />;
}
