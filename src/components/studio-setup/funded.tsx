"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Arrow, ButtonLink, CheckDot, KeyValue, PhoneColumn, Spinner, Ticket } from "@/components/ui";
import { useStudio } from "@/components/studio/studio-context";
import { getWalletSummary, latestFunding, listWalletActivity, type ActivityEntry } from "@/lib/data/studio";
import { getEpisode } from "@/lib/data/episodes";
import { formatNaira } from "@/lib/money";
import type { Episode, WalletSummary } from "@/types/domain";

interface Data {
  entry: ActivityEntry | null;
  summary: WalletSummary | null;
  episode: Episode | null;
  episodeFunded: number;
}

export function Funded() {
  const ctx = useStudio();
  const since = useSearchParams().get("since");
  const [data, setData] = useState<Data | null>(null);
  const creatorId = ctx?.creator.id;

  useEffect(() => {
    if (!creatorId) return;
    let alive = true;
    (async () => {
      const [hit, summary, activity] = await Promise.all([
        since ? latestFunding(creatorId, since).catch(() => null) : Promise.resolve(null),
        getWalletSummary(creatorId).catch(() => null),
        listWalletActivity(creatorId).catch(() => [] as ActivityEntry[]),
      ]);
      const entry = hit ?? activity.find((e) => e.kind === "topup" || e.kind === "sponsor") ?? null;
      const episode = entry?.episode_id ? await getEpisode(entry.episode_id).catch(() => null) : null;
      const episodeFunded = episode
        ? activity.filter((e) => e.episode_id === episode.id && (e.kind === "topup" || e.kind === "sponsor")).reduce((s, e) => s + e.amount, 0)
        : 0;
      if (alive) setData({ entry, summary, episode, episodeFunded });
    })();
    return () => {
      alive = false;
    };
  }, [creatorId, since]);

  if (!data)
    return (
      <main className="theme-yellow flex flex-1 flex-col">
        <Spinner />
      </main>
    );

  const { entry, summary, episode, episodeFunded } = data;
  const from = entry?.kind === "sponsor" ? entry.counterparty || "Sponsor funding link" : entry?.counterparty;

  return (
    <main className="theme-yellow flex flex-1 flex-col overflow-hidden">
      <PhoneColumn className="px-8 pt-12 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <p className="flex items-center gap-3" aria-live="polite">
          <CheckDot size="sm" />
          <span className="font-mono text-[17px] font-semibold tracking-[0.12em]">WALLET FUNDED</span>
        </p>
        {entry ? (
          <>
            <p className="font-display tabular mt-8 -mr-8 text-[clamp(120px,44vw,200px)] leading-[0.8] whitespace-nowrap">
              <span className="block">+</span>
              {formatNaira(entry.amount)}
            </p>
            {from && <p className="font-wide mt-5 text-[clamp(17px,5vw,21px)] leading-snug">from {from}</p>}
          </>
        ) : (
          <p className="font-wide mt-8 text-[22px]">Your transfer is in.</p>
        )}

        <div className="mt-auto space-y-4 pt-10">
          <Ticket bodyClassName="space-y-3 px-6 py-6">
            <KeyValue
              k="Assigned to"
              v={<span className="block max-w-[180px] truncate text-yellow">{episode ? `Ep ${episode.number} · ${episode.title}` : "Free balance"}</span>}
            />
            {episode && <KeyValue k="Episode budget" v={`${formatNaira(Math.min(episodeFunded, episode.budget))} / ${formatNaira(episode.budget)}`} />}
            {summary && <KeyValue k="New balance" v={formatNaira(summary.balance)} />}
          </Ticket>
          <ButtonLink href={episode ? `/studio/episodes/${episode.id}` : "/studio/episodes/new"}>
            Plan the episode <Arrow />
          </ButtonLink>
          <ButtonLink href="/studio/wallet" variant="outline" size="md" font="bold">
            Back to wallet
          </ButtonLink>
        </div>
      </PhoneColumn>
    </main>
  );
}
