import type { Metadata } from "next";
import { Home } from "@/components/studio-setup/home";

export const metadata: Metadata = { title: "Home" };

export default function StudioHomePage() {
  return <Home />;
}
