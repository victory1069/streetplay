"use client";

import { useEffect, useState } from "react";
import { Arrow, ButtonLink, Caption, Headline, PhoneColumn } from "@/components/ui";
import { onOutboxChange, outboxItems, type OutboxItem } from "@/lib/offline/outbox";
import { formatNaira } from "@/lib/money";
import { timeWAT } from "@/lib/format";
import { OfflineStrip, useNoSignal } from "./offline-strip";

function useQueuedItems(episodeId: string): OutboxItem[] | null {
  const [items, setItems] = useState<OutboxItem[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      void outboxItems()
        .then((all) => alive && setItems(all.filter((i) => i.state === "queued" && i.draft.episode_id === episodeId)))
        .catch(() => alive && setItems([]));
    load();
    const off = onOutboxChange(load);
    return () => {
      alive = false;
      off();
    };
  }, [episodeId]);
  return items;
}

/** "QUEUED. SENDS WHEN NETWORK RETURNS." Every payout waiting on this phone for the episode. */
export function QueuedScreen({ episodeId }: { episodeId: string }) {
  const items = useQueuedItems(episodeId);
  const offline = useNoSignal();
  const none = items !== null && items.length === 0;

  return (
    <main className="theme-ink flex flex-1 flex-col">
      <PhoneColumn className="px-7 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <OfflineStrip episodeId={episodeId} always link={false} />
        <Headline className="mt-4 text-[clamp(52px,16vw,74px)]">
          {none ? "All sent. Nothing queued." : offline ? "Queued. Sends when network returns." : "Sending now."}
        </Headline>

        <ul className="mt-4 flex flex-col gap-3">
          {(items ?? []).map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 rounded-[14px] border-2 border-dashed border-yellow bg-coal px-4 py-4">
              <div className="min-w-0">
                <p className="font-wide truncate text-[19px]">{i.label.name}</p>
                <p className="mt-1 font-mono text-[13px] text-paper/75">
                  {i.draft.hold ? "Claim code" : (i.label.bank ?? "Bank")} · queued {timeWAT(i.updatedAt)}
                </p>
              </div>
              <p className="font-display tabular shrink-0 text-[clamp(36px,11vw,48px)] text-yellow">{formatNaira(i.draft.amount)}</p>
            </li>
          ))}
        </ul>

        {!none && (
          <div className="mt-3 rounded-[14px] bg-paper p-5 text-ink">
            <Caption className="text-[12px]">Say to the winner</Caption>
            <p className="font-wide mt-2 text-[19px] leading-[1.25]">
              &quot;Network don cut, but your money is locked in. It sends the moment we&apos;re back, and you&apos;ll get an SMS receipt.&quot;
            </p>
          </div>
        )}

        <div className="mt-auto pt-8">
          <p className="mb-3 text-center font-mono text-[13px] text-paper/75">Each payout is sent once, even if retried</p>
          <ButtonLink href={`/studio/episodes/${episodeId}`} variant="outline-light" className="min-h-[60px] text-[32px]">
            Keep playing <Arrow />
          </ButtonLink>
        </div>
      </PhoneColumn>
    </main>
  );
}
