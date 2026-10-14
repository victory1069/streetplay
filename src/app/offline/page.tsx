import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline" };

// Served by the service worker when a page isn't cached and there's no network.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-bold">You&apos;re offline</h1>
      <p className="text-muted">This page needs a connection. Games you&apos;ve already opened keep working.</p>
    </main>
  );
}
