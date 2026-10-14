"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useOffline } from "next/offline";
import { onOutboxChange, queuedCount } from "@/lib/offline/outbox";

/** Payouts still waiting in this phone's outbox for an episode. */
export function useQueuedCount(episodeId: string): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () =>
      void queuedCount(episodeId)
        .then((n) => alive && setCount(n))
        .catch(() => {});
    load();
    const off = onOutboxChange(load);
    const t = window.setInterval(load, 10_000);
    return () => {
      alive = false;
      off();
      window.clearInterval(t);
    };
  }, [episodeId]);
  return count;
}

/** True when the browser or Next says there's no network. */
export function useNoSignal(): boolean {
  const offline = useOffline();
  const [browserOffline, setBrowserOffline] = useState(false);
  useEffect(() => {
    const sync = () => setBrowserOffline(!navigator.onLine);
    const t = window.setTimeout(sync, 0);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return offline || browserOffline;
}

/** Red "Offline · games still work · 2 queued" strip. Tapping it opens the queued list. */
export function OfflineStrip({ episodeId, always = false, link = true }: { episodeId: string; always?: boolean; link?: boolean }) {
  const offline = useNoSignal();
  const queued = useQueuedCount(episodeId);
  if (!always && !offline && queued === 0) return null;

  const body = (
    <>
      <span className="font-wide text-[15px]">{offline ? "Offline · games still work" : "Back online · sending"}</span>
      <span className="font-mono text-[15px] font-semibold">{queued} queued</span>
    </>
  );
  const cls = `flex min-h-[44px] items-center justify-between gap-3 rounded-[10px] px-4 text-paper ${offline ? "bg-red" : "bg-smoke"}`;
  return link ? (
    <Link href={`/studio/episodes/${episodeId}/queued`} role="status" className={cls}>
      {body}
    </Link>
  ) : (
    <div role="status" className={cls}>
      {body}
    </div>
  );
}
