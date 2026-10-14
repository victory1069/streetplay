"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Arrow, Bar, Button, ErrorText, Logo, PhoneColumn, Spinner } from "@/components/ui";
import { useStudio } from "@/components/studio/studio-context";
import { OfflineStrip } from "@/components/payout/offline-strip";
import {
  episodeTotals,
  getEpisode,
  getEpisodeLog,
  goLive,
  subscribeToEpisode,
  type EpisodeLog,
} from "@/lib/data/episodes";
import { subscribeToPayouts } from "@/lib/data/payouts";
import { announceNextRound } from "@/lib/live/auto";
import { cached } from "@/lib/offline/idb";
import { onOutboxChange } from "@/lib/offline/outbox";
import { FORMATS } from "@/lib/games/formats";
import { planTag } from "@/lib/games/plan";
import { formatNaira } from "@/lib/money";
import type { Episode, FormatId } from "@/types/domain";
import { PLAYABLE } from "./rules";

/** The host's home base on the street: budget left, pick the next game, go. */
export function EpisodeConsole({ episodeId }: { episodeId: string }) {
  const router = useRouter();
  const studio = useStudio();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [log, setLog] = useState<EpisodeLog | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState<FormatId | null>(null);
  const [menu, setMenu] = useState(false);
  const [going, setGoing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLog = useCallback(() => {
    void cached(`episode-log:${episodeId}`, () => getEpisodeLog(episodeId))
      .then(setLog)
      .catch(() => {});
  }, [episodeId]);

  useEffect(() => {
    let alive = true;
    getEpisode(episodeId)
      .then((ep) => alive && setEpisode(ep))
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    loadLog();
    const offEp = subscribeToEpisode(episodeId, (ep) => setEpisode((cur) => ({ ...cur, ...ep })));
    const offPay = subscribeToPayouts(episodeId, () => loadLog());
    const offOutbox = onOutboxChange(loadLog);
    return () => {
      alive = false;
      offEp();
      offPay();
      offOutbox();
    };
  }, [episodeId, loadLog]);

  if (!loaded || !studio) {
    return (
      <main className="theme-ink flex flex-1 flex-col">
        <Spinner />
      </main>
    );
  }
  if (!episode) {
    return (
      <main className="theme-ink flex flex-1 flex-col">
        <PhoneColumn className="gap-4 px-7 py-10">
          <p className="font-display text-[48px]">Episode not found.</p>
          <Link href="/studio" className="underline underline-offset-4">
            Back to episodes
          </Link>
        </PhoneColumn>
      </main>
    );
  }

  const formats = (episode.formats.length ? episode.formats : PLAYABLE).filter((f) => PLAYABLE.includes(f));
  const selected = picked && formats.includes(picked) ? picked : formats[0];
  const totals = log ? episodeTotals({ ...log, episode }) : null;
  const budgetLeft = totals?.budgetLeft ?? episode.budget;
  const roundsRun = totals?.rounds ?? 0;
  const base = `/studio/episodes/${episode.id}`;

  const start = () => {
    if (!selected) return;
    const roundId = crypto.randomUUID();
    const n = roundsRun + 1;
    void announceNextRound(episode, selected, n);
    router.push(`${base}/rounds/${roundId}?format=${selected}&n=${n}`);
  };

  const live = async () => {
    setGoing(true);
    setError(null);
    try {
      setEpisode(await goLive(episode.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't go live.");
    } finally {
      setGoing(false);
    }
  };

  return (
    <main className="theme-ink flex flex-1 flex-col">
      <PhoneColumn className="px-7 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <OfflineStrip episodeId={episode.id} />

        <header className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link href="/studio" aria-label="All episodes">
            <Logo inverted />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {episode.status === "draft" && (
              <button
                type="button"
                onClick={live}
                disabled={going}
                className="font-label min-h-[36px] rounded-full border-2 border-yellow px-3 text-[11px] text-yellow disabled:opacity-50"
              >
                {going ? "…" : "Go live"}
              </button>
            )}
            {episode.status === "live" && (
              <span className="font-mono text-[13px] text-red">● LIVE</span>
            )}
            <div className="relative">
              <button
                type="button"
                aria-label="More"
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
                className="grid size-11 place-items-center rounded-full text-[24px] leading-none text-paper/85"
              >
                ⋯
              </button>
              {menu && (
                <>
                  <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(false)} />
                  <nav className="absolute top-full right-0 z-40 mt-1 w-52 overflow-hidden rounded-[14px] border-2 border-smoke bg-coal">
                    {[
                      ["Episode log", `${base}/log`],
                      ["Live control", `${base}/live`],
                      ["Queued payouts", `${base}/queued`],
                      ["Wrap episode", `${base}/wrap`],
                    ].map(([label, href]) => (
                      <Link key={href} href={href} className="font-wide flex min-h-[48px] items-center border-b border-smoke px-4 text-[16px] last:border-b-0 active:bg-smoke">
                        {label}
                      </Link>
                    ))}
                  </nav>
                </>
              )}
            </div>
          </div>
        </header>
        <ErrorText>{error}</ErrorText>

        <div className="mt-5 flex items-baseline justify-between gap-2 font-label text-[12px] text-paper/80">
          <span>Ep {episode.number} · Budget left</span>
          <span>
            {roundsRun} rounds · {totals?.paidCount ?? 0} paid
          </span>
        </div>
        <p className="font-display tabular mt-1 text-[clamp(64px,21vw,96px)] leading-[0.85] text-yellow">{formatNaira(budgetLeft)}</p>
        <Bar value={episode.budget ? budgetLeft / episode.budget : 0} tone="dark" fill="yellow" className="mt-2 h-2" />

        <h2 className="font-display mt-8 text-[clamp(32px,10vw,40px)]">Next round</h2>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {formats.map((f) => {
            const on = f === selected;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(f)}
                className={`relative flex min-h-[176px] flex-col justify-between rounded-[14px] p-4 text-left transition-transform active:scale-[0.98] ${
                  on ? "bg-yellow text-ink" : "border-2 border-smoke bg-coal text-paper"
                }`}
              >
                <span className={`font-mono text-[13px] ${on ? "" : "text-paper/80"}`}>{planTag(f, episode.format_plan[f])}</span>
                <span className="font-wide text-[21px] leading-[1.05]">{FORMATS[f].name}</span>
                {on && <span aria-hidden className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 rounded-full bg-page" />}
              </button>
            );
          })}
        </div>

        <div className="mt-auto pt-6">
          {episode.status === "wrapped" ? (
            <p className="text-center font-mono text-[14px] text-paper/70">This episode is wrapped. Start a new one from Episodes.</p>
          ) : (
            <Button variant="yellow" onClick={start} disabled={!selected} className="min-h-[68px] text-[34px]">
              Get consent <Arrow />
            </Button>
          )}
        </div>
      </PhoneColumn>
    </main>
  );
}
