"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useOffline } from "next/offline";
import { Arrow, ButtonLink, Headline } from "@/components/ui";
import { getLeaderboard, getLiveSession, getMyStanding } from "@/lib/data/live";
import { formatNaira } from "@/lib/money";
import { timeWAT } from "@/lib/format";
import type { FanStanding, LeaderboardPeriod, LeaderboardRow, LiveSession } from "@/types/domain";
import { BoardRows, MeRow, PlayHeader, ShakyStrip, othersOnly, pts } from "./chrome";
import { firstName } from "./hooks";
import { RemindButton } from "./join";

// /play/[handle]/board: TOP PLAYERS for this Live, this month, all time.

const TABS: { id: LeaderboardPeriod; label: string }[] = [
  { id: "live", label: "This Live" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

export function Board({ initial }: { initial: LiveSession }) {
  const handle = initial.handle;
  const [session, setSession] = useState(initial);
  const [period, setPeriod] = useState<LeaderboardPeriod>("live");
  const [boards, setBoards] = useState<Partial<Record<LeaderboardPeriod, LeaderboardRow[]>>>({});
  const [me, setMe] = useState<FanStanding | null>(null);
  const [netFail, setNetFail] = useState(false);
  const offline = useOffline();

  const episodeId = session.episode_id;
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [rows, s] = await Promise.all([
          period === "live" && !episodeId ? Promise.resolve([]) : getLeaderboard(session.creator_id, period === "live" ? episodeId : null, period, 20),
          getLiveSession(handle),
        ]);
        if (!alive) return;
        setBoards((b) => ({ ...b, [period]: rows }));
        if (s) setSession(s);
        setNetFail(false);
      } catch {
        if (alive) setNetFail(true);
      }
      getMyStanding(handle)
        .then((m) => alive && setMe(m))
        .catch(() => {});
    };
    void load();
    const t = window.setInterval(load, 15_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [period, episodeId, session.creator_id, handle]);

  const rows = boards[period];
  const ended = session.status !== "live";
  const podium = ended && period === "live" && rows ? rows.slice(0, 3) : [];
  const rest = othersOnly(rows ?? [], me, period === "live").filter((r) => !podium.includes(r));
  const mine =
    me && rows
      ? period === "live"
        ? { rank: me.rank, points: me.points }
        : (() => {
            const r = rows.find((x) => x.display_name === me.display_name);
            return r ? { rank: r.rank, points: r.points } : null;
          })()
      : null;
  const prize = me?.prize ?? null;
  const host = firstName(session.creator_name);
  const isMe = (r: LeaderboardRow) => !!me && r.display_name === me.display_name && (period !== "live" || r.rank === me.rank);

  const right = ended ? (
    <span className="rounded-full bg-ink px-5 py-2 font-mono text-[15px] font-semibold text-paper">
      LIVE ENDED{session.wrapped_at ? ` · ${timeWAT(session.wrapped_at)}` : ""}
    </span>
  ) : undefined;

  return (
    <main className="theme-yellow flex min-h-dvh flex-1 flex-col">
      <PlayHeader session={session} right={right} />
      <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col gap-5 px-5 pt-5 pb-6 lg:grid lg:max-w-[1280px] lg:grid-cols-[1fr_400px] lg:gap-16 lg:px-14 lg:pt-10">
        <section className="flex flex-col gap-5">
          {(offline || netFail) && <ShakyStrip />}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <Headline className="text-[clamp(56px,17vw,80px)] lg:text-[112px]">TOP PLAYERS</Headline>
            <div role="tablist" className="grid grid-cols-3 overflow-hidden rounded-[14px] border-[3px] border-ink lg:w-[500px]">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  aria-selected={period === t.id}
                  onClick={() => setPeriod(t.id)}
                  className={`font-wide min-h-[48px] px-2 text-[16px] lg:text-[18px] ${period === t.id ? "bg-ink text-yellow" : ""}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {podium.length > 0 && (
            <ol className="grid gap-4 sm:grid-cols-3">
              {podium.map((r) => {
                const you = isMe(r);
                return (
                  <li
                    key={r.rank}
                    className={`rounded-[16px] px-7 py-5 ${you ? "border-[3px] border-ink bg-card text-ink shadow-[8px_8px_0_var(--red)]" : "bg-ink text-paper"}`}
                  >
                    <p className={`font-display text-[72px] ${you ? "" : "text-yellow"}`}>{r.rank}</p>
                    <p className="font-wide mt-2 truncate text-[22px]">
                      {r.display_name}
                      {you && " (you)"}
                    </p>
                    <p className={`mt-1 font-mono text-[16px] ${you ? "" : "text-yellow"}`}>
                      {pts(r.points)}
                      {prize ? ` · ${formatNaira(prize.amount)}` : ""}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}

          {rows ? <BoardRows rows={rest} streaks size="lg" /> : <p className="font-label sp-pulse py-6">Loading…</p>}

          <div className="sticky bottom-4 mt-auto pt-4 lg:hidden">
            {me && mine && <MeRow rank={mine.rank > 0 ? mine.rank : "–"} name={me.display_name} points={mine.points} />}
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          {me && (
            <div className="hidden rounded-[18px] bg-ink px-9 py-8 text-paper lg:block">
              <p className="font-label text-yellow">Your Live</p>
              <div className="mt-3 grid grid-cols-2 gap-6">
                <div>
                  <p className="font-display tabular text-[88px] text-yellow">{me.points.toLocaleString("en-NG")}</p>
                  <p className="text-[18px]">points</p>
                </div>
                <div>
                  <p className="font-display tabular text-[88px] text-yellow">
                    {me.correct}/{me.answered}
                  </p>
                  <p className="text-[18px]">called right</p>
                </div>
              </div>
            </div>
          )}
          <div className="mt-auto flex flex-col gap-5">
            {prize && (
              <div className="rounded-[18px] border-[3px] border-ink bg-card px-7 py-6">
                <p className="font-wide text-[24px] leading-tight">Top players win {formatNaira(prize.amount)} each</p>
                <p className="mt-2 text-[18px] leading-snug">You placed. Check your notifications, or claim below.</p>
                <ButtonLink href={`/win/${prize.code}`} className="mt-5">
                  CLAIM MY PRIZE <Arrow />
                </ButtonLink>
              </div>
            )}
            {ended ? (
              <RemindButton handle={handle} label={`Remind me about ${host}'s next Live`} />
            ) : (
              <Link
                href={`/play/${encodeURIComponent(handle)}`}
                className="font-wide flex min-h-[52px] items-center justify-center rounded-[14px] border-[3px] border-ink text-[18px]"
              >
                Back to the game →
              </Link>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
