"use client";

import { useOffline } from "next/offline";

// Thin app-wide strip. Studio screens show their own richer offline state
// ("Offline · games still work · 2 queued"); this covers everything else.
export function OfflineBanner() {
  const isOffline = useOffline();
  if (!isOffline) return null;

  return (
    <div role="status" className="sticky top-0 z-50 bg-ink px-4 py-1.5 text-center font-mono text-xs text-yellow">
      <span className="mr-2 inline-block size-2 rounded-full bg-yellow align-middle sp-pulse" />
      Network dey shaky. We&apos;ll catch up when it&apos;s back.
    </div>
  );
}
