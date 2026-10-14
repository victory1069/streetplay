import type { Metadata } from "next";
import { Welcome } from "@/components/studio-setup/welcome";

export const metadata: Metadata = { title: "Set up your show" };

export default function WelcomePage() {
  return <Welcome />;
}
