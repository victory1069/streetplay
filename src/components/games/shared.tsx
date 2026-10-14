"use client";

import { useRef, useState, type ReactNode } from "react";
import { addClipMarker } from "@/lib/data/episodes";
import type { ClipMarker, Episode, FormatPlanEntry, Kobo, Round, RoundStatus, SongCard } from "@/types/domain";
import { SONG_PACKS } from "@/content";

// Pieces every game screen shares: the caption row with MARK CLIP, the big
// RIGHT/WRONG pair (long-press either to undo), song cards and timers.

export type EndStatus = Exclude<RoundStatus, "setup" | "playing">;

export interface GameProps {
  episode: Episode;
  round: Round;
  plan: FormatPlanEntry;
  /** "R8"; null until the server numbers the round. */
  roundNumber: number | null;
  onEnd: (status: EndStatus, prize: Kobo, summary: string, result: Record<string, unknown>) => void;
  /** Persist in-progress state (so a refresh resumes). */
  onSave: (result: Record<string, unknown>, prizeSoFar: Kobo) => void;
}

/**
 * Tap vs long-press on one element. Long-press fires after `ms` and swallows
 * the click that follows it.
 */
export function useLongPress(onTap: () => void, onLong: () => void, ms = 550) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: () => {
      fired.current = false;
      clear();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(30);
        onLong();
      }, ms);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    onClick: () => {
      if (fired.current) {
        fired.current = false;
        return;
      }
      onTap();
    },
  };
}

const CLIP_LABELS: { id: ClipMarker["label"]; text: string }[] = [
  { id: "reaction", text: "Reaction" },
  { id: "funny", text: "Funny" },
  { id: "big-win", text: "Big win" },
];

/** "◆ MARK CLIP": tap marks a reaction, long-press picks the label. */
export function MarkClip({ episodeId, roundId }: { episodeId: string; roundId: string }) {
  const [menu, setMenu] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const mark = (label: ClipMarker["label"], text: string) => {
    setMenu(false);
    void addClipMarker(episodeId, label, roundId);
    navigator.vibrate?.(20);
    setFlash(text);
    window.setTimeout(() => setFlash(null), 1400);
  };
  const press = useLongPress(
    () => mark("reaction", "Reaction"),
    () => setMenu(true),
  );

  return (
    <div className="relative">
      <button
        type="button"
        {...press}
        aria-label="Mark clip (long-press for labels)"
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 px-4 font-label text-[13px] select-none ${flash ? "border-yellow text-yellow" : "border-smoke text-paper/85"}`}
      >
        <span aria-hidden>◆</span>
        <span aria-live="polite">{flash ? `Marked · ${flash}` : "Mark clip"}</span>
      </button>
      {menu && (
        <>
          <button type="button" aria-label="Close" className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(false)} />
          <div role="menu" className="absolute top-full right-0 z-40 mt-2 w-44 overflow-hidden rounded-[14px] border-2 border-smoke bg-coal">
            {CLIP_LABELS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="menuitem"
                onClick={() => mark(l.id, l.text)}
                className="block min-h-[48px] w-full border-b border-smoke px-4 text-left font-wide text-[16px] last:border-b-0 active:bg-smoke"
              >
                {l.text}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** "R8 · FINISH THE LYRIC" + MARK CLIP (or a timer chip). */
export function GameTop({
  roundNumber,
  name,
  episodeId,
  roundId,
  right,
}: {
  roundNumber: number | null;
  name: string;
  episodeId: string;
  roundId: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-4">
      <p className="font-label min-w-0 truncate text-[13px] text-paper/80">
        {roundNumber ? `R${roundNumber} · ` : ""}
        {name}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        {right}
        <MarkClip episodeId={episodeId} roundId={roundId} />
      </div>
    </div>
  );
}

/** Red "0:12" chip. */
export function TimerChip({ seconds }: { seconds: number | null }) {
  const s = seconds ?? 0;
  return (
    <span
      aria-live="off"
      className={`inline-flex min-h-[44px] items-center bg-red px-3 font-mono text-[22px] font-semibold text-paper tabular ${seconds !== null && s <= 0 ? "sp-pulse" : ""}`}
    >
      {seconds === null ? "0:30" : clockStr(s)}
    </span>
  );
}

export function clockStr(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Big WRONG / RIGHT pair. Long-press either one to undo the last action. */
export function RightWrong({
  onRight,
  onWrong,
  onUndo,
  disabled,
  rightLabel = "Right",
  wrongLabel = "Wrong",
}: {
  onRight: () => void;
  onWrong: () => void;
  onUndo?: () => void;
  disabled?: boolean;
  rightLabel?: string;
  wrongLabel?: string;
}) {
  const undo = onUndo ?? (() => {});
  const wrong = useLongPress(onWrong, undo);
  const right = useLongPress(onRight, undo);
  const base =
    "flex min-h-[80px] flex-1 items-center justify-center gap-3 rounded-[14px] font-display text-[40px] select-none active:scale-[0.98] disabled:opacity-40";
  return (
    <div className="flex gap-2">
      <button type="button" disabled={disabled} {...wrong} className={`${base} bg-red text-paper`}>
        <span aria-hidden className="font-sans text-[40px] font-light">✕</span>
        {wrongLabel}
      </button>
      <button type="button" disabled={disabled} {...right} className={`${base} bg-green text-ink`}>
        <span aria-hidden className="font-sans text-[40px] font-light">✓</span>
        {rightLabel}
      </button>
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-center font-mono text-[12.5px] text-paper/45">{children}</p>;
}

const DIFFICULTY = { 1: "Easy", 2: "Medium", 3: "Hard" } as const;
const PACK_OF = new Map(SONG_PACKS.flatMap((p) => p.items.map((s) => [s.id, p.title] as const)));

/** The yellow song card ticket. No lyrics, ever. */
export function SongCardTicket({ song, cue = true, onTap }: { song: SongCard; cue?: boolean; onTap?: () => void }) {
  const Tag = onTap ? "button" : "div";
  return (
    <Tag
      {...(onTap ? { type: "button" as const, onClick: onTap } : {})}
      className="relative block w-full rounded-[18px] bg-yellow text-left text-ink"
    >
      <div className="px-[18px] pt-5 pb-4">
        <p className="font-label text-[12px]">Song card · {PACK_OF.get(song.id) ?? "Custom"}</p>
        <p className="font-display mt-4 text-[clamp(44px,14vw,60px)] break-words">{song.title}</p>
        <p className="font-wide text-[17px] leading-tight">{song.artist}</p>
      </div>
      <div className="relative mx-4 border-t-2 border-dashed border-ink">
        <span aria-hidden className="absolute top-0 -left-[calc(1rem+14px)] size-7 -translate-y-1/2 rounded-full bg-page" />
        <span aria-hidden className="absolute top-0 -right-[calc(1rem+14px)] size-7 -translate-y-1/2 rounded-full bg-page" />
        <div className="flex justify-between py-3.5 font-mono text-[15px] font-semibold">
          <span>{cue ? `Stop at ${clockStr(song.cueSeconds)}` : "Play the intro"}</span>
          <span>{DIFFICULTY[song.difficulty]}</span>
        </div>
      </div>
    </Tag>
  );
}

/** Same order for the same seed: used to deal questions and song cards. */
export function seededOrder<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Full-height dark game layout with the action area pinned to the bottom. */
export function GameShell({ children, bottom }: { children: ReactNode; bottom: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col px-7 pb-[calc(env(safe-area-inset-bottom)+20px)]">
      <div className="flex flex-1 flex-col">{children}</div>
      <div className="pt-4">{bottom}</div>
    </div>
  );
}
