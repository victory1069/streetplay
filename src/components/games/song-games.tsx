"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCountdown } from "@/components/ui/interactive";
import { songsFor, SONG_PACKS } from "@/content";
import { seededRandom } from "@/lib/games/fairness";
import { closeLivePrompt, openSongGuess } from "@/lib/live/auto";
import type { LivePrompt } from "@/types/domain";
import { formatNaira, formatShort } from "@/lib/money";
import type { SongCard } from "@/types/domain";
import { clockStr, GameShell, GameTop, Hint, RightWrong, seededOrder, SongCardTicket, type GameProps } from "./shared";

export function roundSeed(round: GameProps["round"]): string {
  return round.seed ?? round.id.replace(/-/g, "");
}

function useSongDeck(packIds: string[], seed: string): SongCard[] {
  return useMemo(() => {
    const picked = songsFor(packIds);
    const all = picked.length ? picked : SONG_PACKS.flatMap((p) => p.items);
    return seededOrder(all, seededRandom(seed));
  }, [packIds, seed]);
}

/** Huge countdown under the card. Idle until the host taps "music stopped". */
function SingClock({ left, total, idleLabel, runningLabel }: { left: number | null; total: number; idleLabel: string; runningLabel: string }) {
  const running = left !== null;
  const out = running && left <= 0;
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-6 text-center" aria-live="polite">
      <p className={`font-label text-[14px] font-semibold ${running ? "text-red" : "text-paper/55"}`}>
        {running ? (out ? "● Time!" : `● ${runningLabel}`) : idleLabel}
      </p>
      <p className={`font-display tabular text-[clamp(120px,42vw,190px)] leading-[0.82] ${out ? "text-red sp-pulse" : running ? "text-paper" : "text-paper/30"}`}>
        {clockStr(running ? left : total)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Finish the Lyric

const LYRIC_SECONDS = 10;
const MAX_LINES = 3;

export function FinishTheLyric({ episode, round, plan, roundNumber, onEnd, onSave }: GameProps) {
  const deck = useSongDeck(episode.pack_ids, roundSeed(round));
  const saved = round.result as { idx?: number; lines?: number };
  const [idx, setIdx] = useState(saved.idx ?? 0);
  const [lines, setLines] = useState(saved.lines ?? 0);
  const [history, setHistory] = useState<("right" | "skip")[]>([]);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const left = useCountdown(endsAt);
  const song = deck[idx % deck.length];
  const touchY = useRef<number | null>(null);

  const persist = (nextIdx: number, nextLines: number) => onSave({ idx: nextIdx, lines: nextLines, stage: "play" }, nextLines * plan.unit);

  const right = () => {
    const n = lines + 1;
    if (n >= MAX_LINES) {
      onEnd("won", n * plan.unit, `${n} lines`, { lines: n, songs: deck.slice(0, idx + 1).map((s) => s.id) });
      return;
    }
    setLines(n);
    setIdx(idx + 1);
    setHistory([...history, "right"]);
    setEndsAt(null);
    persist(idx + 1, n);
  };
  const wrong = () => {
    const songs = deck.slice(0, idx + 1).map((s) => s.id);
    onEnd(lines > 0 ? "won" : "lost", lines * plan.unit, lines === 1 ? "1 line" : `${lines} lines`, { lines, songs });
  };
  const skip = () => {
    setIdx(idx + 1);
    setHistory([...history, "skip"]);
    setEndsAt(null);
    persist(idx + 1, lines);
  };
  const undo = () => {
    const last = history.at(-1);
    if (!last) return;
    const nLines = last === "right" ? lines - 1 : lines;
    setHistory(history.slice(0, -1));
    setIdx(idx - 1);
    setLines(nLines);
    setEndsAt(null);
    persist(idx - 1, nLines);
  };

  return (
    <GameShell
      bottom={
        <>
          <RightWrong onRight={right} onWrong={wrong} onUndo={undo} />
          <Hint>Long-press to undo · swipe up for next line</Hint>
        </>
      }
    >
      <GameTop roundNumber={roundNumber} name="Finish the Lyric" episodeId={episode.id} roundId={round.id} />
      <div
        className="mt-6 touch-pan-x"
        onTouchStart={(e) => (touchY.current = e.touches[0].clientY)}
        onTouchEnd={(e) => {
          const start = touchY.current;
          touchY.current = null;
          if (start !== null && start - e.changedTouches[0].clientY > 60) skip();
        }}
      >
        <SongCardTicket song={song} onTap={() => setEndsAt(Date.now() + LYRIC_SECONDS * 1000)} />
      </div>
      <SingClock left={left} total={LYRIC_SECONDS} idleLabel="Tap the card when the music stops" runningLabel="Music stopped · they sing" />
      <p className="-mt-4 mb-2 text-center font-mono text-[16px] text-paper/80">
        {lines === 1 ? "1 line" : `${lines} lines`} right · {formatNaira(lines * plan.unit)} so far
      </p>
    </GameShell>
  );
}

// ---------------------------------------------------------------- Name the Song

const SONG_SECONDS = 20;
const announced = new Set<string>();

export function NameTheSong({ episode, round, plan, roundNumber, onEnd, onSave }: GameProps) {
  const deck = useSongDeck(episode.pack_ids, roundSeed(round));
  const saved = round.result as { idx?: number; title?: boolean };
  const [idx, setIdx] = useState(saved.idx ?? 0);
  const [title, setTitle] = useState(saved.title ?? false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const left = useCountdown(endsAt);
  const song = deck[idx % deck.length];
  const bonus = Math.round(plan.unit / 2);
  const touchY = useRef<number | null>(null);

  // The viewer prompt must always match the card being played.
  const prompt = useRef<LivePrompt | null>(null);
  const announce = (card: typeof song) => {
    void closeLivePrompt(prompt.current);
    prompt.current = null;
    void openSongGuess(episode, round, roundNumber ?? 0, card).then((p) => {
      prompt.current = p;
    });
  };

  useEffect(() => {
    if (announced.has(round.id) || saved.title !== undefined) return;
    announced.add(round.id);
    announce(song);
    // Once per round, with the first card dealt; skips re-announce.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const result = (artist: boolean) => ({ song: song.id, title: true, artist });

  const right = () => {
    setTitle(true);
    setEndsAt(null);
    onSave({ idx, title: true, stage: "play" }, plan.unit);
  };
  const wrong = () => {
    void closeLivePrompt(prompt.current);
    onEnd("lost", 0, "Missed", { song: song.id, title: false, artist: false });
  };
  const undo = () => {
    if (!title) return;
    setTitle(false);
    onSave({ idx, title: false, stage: "play" }, 0);
  };
  const skip = () => {
    if (title) return;
    setIdx(idx + 1);
    setEndsAt(null);
    onSave({ idx: idx + 1, title: false, stage: "play" }, 0);
    announce(deck[(idx + 1) % deck.length]);
  };

  return (
    <GameShell
      bottom={
        title ? (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onEnd("won", plan.unit, "Title", result(false))}
                className="flex min-h-[80px] flex-1 items-center justify-center rounded-[14px] border-2 border-paper font-display text-[32px] text-paper active:scale-[0.98]"
              >
                Title only
              </button>
              <button
                type="button"
                onClick={() => onEnd("won", plan.unit + bonus, "Title + artist", result(true))}
                className="flex min-h-[80px] flex-1 items-center justify-center rounded-[14px] bg-green font-display text-[36px] text-ink active:scale-[0.98]"
              >
                + Artist
              </button>
            </div>
            <Hint>
              <button type="button" onClick={undo} className="underline underline-offset-4">
                Undo title
              </button>
            </Hint>
          </>
        ) : (
          <>
            <RightWrong onRight={right} onWrong={wrong} onUndo={undo} rightLabel="Title" />
            <Hint>Long-press to undo · swipe up for another song</Hint>
          </>
        )
      }
    >
      <GameTop roundNumber={roundNumber} name="Name the Song" episodeId={episode.id} roundId={round.id} />
      <div
        className="mt-6"
        onTouchStart={(e) => (touchY.current = e.touches[0].clientY)}
        onTouchEnd={(e) => {
          const start = touchY.current;
          touchY.current = null;
          if (start !== null && start - e.changedTouches[0].clientY > 60) skip();
        }}
      >
        <SongCardTicket song={song} cue={false} onTap={() => !title && setEndsAt(Date.now() + SONG_SECONDS * 1000)} />
      </div>
      {title ? (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center" aria-live="polite">
          <p className="font-label text-[14px] font-semibold text-green">✓ Title right · {formatNaira(plan.unit)}</p>
          <p className="font-display mt-3 text-[clamp(56px,18vw,84px)]">Artist?</p>
          <p className="mt-2 font-mono text-[16px] text-paper/80">+{formatShort(bonus)} if they name it</p>
        </div>
      ) : (
        <SingClock left={left} total={SONG_SECONDS} idleLabel="Tap the card when the intro plays" runningLabel="Name it" />
      )}
    </GameShell>
  );
}
