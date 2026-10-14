import { Suspense } from "react";
import { Landing } from "@/components/studio-setup/landing";

// Landing + host phone sign-in (yellow).
export default function Home() {
  return (
    <Suspense fallback={<main className="theme-yellow flex-1" />}>
      <Landing />
    </Suspense>
  );
}
