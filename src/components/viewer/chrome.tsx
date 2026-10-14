import type { ReactNode } from "react";
import { LiveBadge, Logo } from "@/components/ui";
import type { FanStanding, LeaderboardRow, LiveSession } from "@/types/domain";

// Frame pieces shared by the viewer game and its board: top bars, the
// desktop "TOP PLAYERS · THIS LIVE" sidebar and the bottom "you" bar.

export const handleLabel = (s: Pick<LiveSession, "handle">) => `@${s.handle}`;

export function showLine(s: LiveSession): string {
  return [handleLabel(s), s.episode_number != null ? `Ep ${s.episode_number}` : null, s.title].filter(Boolean).join(" · ");
}

export const instagramLive = (handle: string) => `https://instagram.com/${encodeURIComponent(handle)}/live`;

export const pts = (n: number) => `${n.toLocaleString("en-NG")} pts`;
export const rankLabel = (r: number | null | undefined) => (r && r > 0 ? `#${r}` : "#–");

/** Mobile: logo + LIVE badge. Desktop: logo, show line, badge, "name · pts" pill. */
export function PlayHeader({
  session,
  me,
  dark = false,
  right,
}: {
  session: LiveSession;
  me?: FanStanding | null;
  dark?: boolean;
  /** Replaces the live badge (e.g. "LIVE ENDED · 16:01"). */
  right?: ReactNode;
}) {
  const live = session.status === "live";
  const badge = right ?? (live ? <LiveBadge count={session.players} tone={dark ? "smoke" : "ink"} /> : null);
  return (
    <>
      <header className="flex items-center justify-between gap-3 px-5 pt-5 lg:hidden">
        <Logo inverted={dark} />
        {badge}
      </header>
      <header className={`hidden items-center gap-8 border-b-[3px] px-9 py-5 lg:flex ${dark ? "border-smoke" : "border-ink"}`}>
        <Logo inverted={dark} />
        <p className="font-wide min-w-0 flex-1 truncate text-[22px]">{showLine(session)}</p>
        {badge}
        {me && (
          <span className={`font-wide rounded-full border-2 px-5 py-2 text-[18px] ${dark ? "border-smoke" : "border-ink bg-card"}`}>
            {me.display_name} · {pts(me.points)}
          </span>
        )}
      </header>
    </>
  );
}

/** Black row with red offset shadow ("7  tunde_k (you)  340"). Yellow on dark pages. */
export function MeRow({ rank, name, points, dark = false, className = "" }: { rank: ReactNode; name: string; points: number; dark?: boolean; className?: string }) {
  return (
    <div
      className={`flex items-center gap-5 rounded-[14px] px-6 py-4 ${dark ? "bg-yellow text-ink" : "bg-ink text-yellow shadow-[6px_6px_0_var(--red)]"} ${className}`}
    >
      <span className="w-8 font-mono text-[17px] font-semibold">{rank}</span>
      <span className="font-wide min-w-0 flex-1 truncate text-[20px]">{name} (you)</span>
      <span className="font-mono text-[18px] font-semibold tabular">{points.toLocaleString("en-NG")}</span>
    </div>
  );
}

/** Ruled leaderboard rows. */
export function BoardRows({ rows, streaks = false, size = "md" }: { rows: LeaderboardRow[]; streaks?: boolean; size?: "md" | "lg" }) {
  if (!rows.length) return <p className="py-6 text-[17px] opacity-70">No scores yet. First answer takes the top spot.</p>;
  return (
    <ol className="border-t-[3px] border-current">
      {rows.map((r) => (
        <li key={`${r.rank}-${r.display_name}`} className={`flex items-center gap-4 border-b-2 border-current ${size === "lg" ? "py-4" : "py-3"}`}>
          <span className="w-10 shrink-0 font-mono text-[17px] font-semibold">{r.rank}</span>
          <span className={`font-wide min-w-0 flex-1 truncate ${size === "lg" ? "text-[24px]" : "text-[19px]"}`}>{r.display_name}</span>
          {streaks && r.best_streak >= 2 && <span className="hidden font-mono text-[15px] opacity-70 sm:inline">{r.best_streak} in a row</span>}
          <span className="w-16 text-right font-mono text-[18px] font-semibold tabular">{r.points.toLocaleString("en-NG")}</span>
        </li>
      ))}
    </ol>
  );
}

/** Rows without the viewer's own row (it's pinned separately). */
export function othersOnly(rows: LeaderboardRow[], me: FanStanding | null, byRank = true): LeaderboardRow[] {
  if (!me) return rows;
  return rows.filter((r) => !(r.display_name === me.display_name && (!byRank || r.rank === me.rank)));
}

/** Desktop right column: TOP PLAYERS · THIS LIVE. */
export function Sidebar({ rows, me, handle, dark = false }: { rows: LeaderboardRow[]; me: FanStanding | null; handle: string; dark?: boolean }) {
  return (
    <aside
      className={`hidden w-[400px] shrink-0 flex-col border-l-[3px] px-9 pt-10 pb-8 lg:flex ${dark ? "border-smoke bg-ink text-paper" : "border-ink bg-paper text-ink"}`}
    >
      <div className="mb-4 flex items-end justify-between">
        <h2 className="font-display text-[44px]">TOP PLAYERS</h2>
        <span className="font-label">This Live</span>
      </div>
      <BoardRows rows={othersOnly(rows, me)} />
      <div className="mt-auto flex flex-col gap-5 pt-8">
        {me && <MeRow rank={me.rank > 0 ? me.rank : "–"} name={me.display_name} points={me.points} dark={dark} />}
        <a
          href={instagramLive(handle)}
          target="_blank"
          rel="noopener noreferrer"
          className={`font-wide flex min-h-[56px] items-center justify-center rounded-[14px] border-[3px] text-[18px] ${dark ? "border-paper" : "border-ink bg-card"}`}
        >
          Open the Live on Instagram ↗
        </a>
      </div>
    </aside>
  );
}

/** Mobile bottom bar: "tunde_k      340 pts · #7". */
export function MeBar({ me, extra }: { me: FanStanding; extra?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] border-[3px] border-ink bg-card px-6 py-3.5 text-ink lg:hidden">
      <span className="font-wide min-w-0 truncate text-[20px]">{me.display_name}</span>
      <span className="font-mono text-[17px] font-semibold whitespace-nowrap">
        {pts(me.points)} · {rankLabel(me.rank)}
        {extra}
      </span>
    </div>
  );
}

/** "● Network dey shaky. Your answers are saved." */
export function ShakyStrip() {
  return (
    <div role="status" className="flex items-start gap-3 rounded-[10px] bg-ink px-5 py-3 font-mono text-[14px] leading-snug text-paper">
      <span className="sp-pulse mt-1.5 size-2.5 shrink-0 rounded-full bg-yellow" />
      Network dey shaky. Your answers are saved.
    </div>
  );
}
