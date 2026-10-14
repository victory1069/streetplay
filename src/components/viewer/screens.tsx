"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Arrow, Button, Caption, Shout } from "@/components/ui";
import { clock } from "@/lib/format";
import { FORMATS } from "@/lib/games/formats";
import { ARTIST_BONUS, PREDICT_POINTS, VOTE_POINTS } from "@/lib/games/scoring";
import type { FanStanding, LivePrompt, LiveState, PromptStats, RespondResult } from "@/types/domain";
import { MeBar } from "./chrome";
import { useCountdown } from "./hooks";

// The viewer game screens, one per prompt kind, plus waiting and result.

export interface Answer {
  option?: number;
  text?: string;
  artist?: string;
  pending?: boolean;
  result?: RespondResult;
  error?: string;
  /** Rank when the answer went in, for "#7 → #3". */
  rankBefore?: number;
}

export interface PromptProps {
  prompt: LivePrompt;
  answer?: Answer;
  stats: PromptStats | null;
  secondsLeft: number | null;
  open: boolean;
  host: string;
  onAnswer: (a: Answer) => void;
}

const total = (s: PromptStats | null) => (s ? s.options.reduce((a, b) => a + b, 0) : 0);
const pct = (s: PromptStats | null, i: number) => {
  const t = total(s);
  return t ? Math.round(((s!.options[i] ?? 0) / t) * 100) : null;
};
const n = (x: number) => x.toLocaleString("en-NG");

function promptLabel(p: LivePrompt, fallback: string) {
  return (p.label ?? (p.round_number ? `Round ${p.round_number} · ${fallback}` : fallback)).toUpperCase();
}

/** Keys 1–9 (and A–D when `letters`) → option index; Enter → `onEnter`. */
function useKeys(onIndex: (i: number) => void, count: number, enabled: boolean, opts: { letters?: boolean; onEnter?: () => void } = {}) {
  const { letters = false, onEnter } = opts;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select")) return;
      if (e.key === "Enter" && onEnter) {
        onEnter();
        return;
      }
      let i = -1;
      if (/^[1-9]$/.test(e.key)) i = Number(e.key) - 1;
      else if (letters && /^[a-d]$/i.test(e.key)) i = e.key.toLowerCase().charCodeAt(0) - 97;
      if (i >= 0 && i < count) onIndex(i);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onIndex, count, enabled, letters, onEnter]);
}

function TimerChip({ seconds, tone = "red" }: { seconds: number | null; tone?: "red" | "ink" | "plain" }) {
  if (seconds == null) return null;
  const look = tone === "red" ? "bg-red px-4 py-1.5 text-paper" : tone === "ink" ? "bg-ink px-4 py-1.5 text-yellow" : "";
  return (
    <span role="timer" aria-live="off" className={`font-mono text-[22px] font-semibold tabular lg:text-[26px] ${look}`}>
      {clock(seconds)}
    </span>
  );
}

function PromptTop({ label, timer, dark = false }: { label: string; timer: ReactNode; dark?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Caption className={`text-[14px] font-semibold lg:text-[15px] ${dark ? "text-yellow" : ""}`}>{label}</Caption>
      {timer}
    </div>
  );
}

const Foot = ({ children }: { children: ReactNode }) => (
  <p aria-live="polite" className="mt-5 text-center font-mono text-[14px] leading-snug lg:text-left lg:text-[15px]">
    {children}
  </p>
);

const KeyCap = ({ k, dark = false }: { k: string; dark?: boolean }) => (
  <span
    aria-hidden
    className={`hidden size-9 shrink-0 place-items-center rounded-md border-2 font-mono text-[15px] lg:grid ${dark ? "border-yellow text-yellow" : "border-current"}`}
  >
    {k}
  </span>
);

// ---- Vote ----

export function VoteScreen({ prompt, answer, stats, secondsLeft, open, host, onAnswer }: PromptProps) {
  const voted = answer?.option;
  const canVote = open && voted === undefined;
  useKeys((i) => onAnswer({ option: i }), prompt.options.length, canVote);

  return (
    <div className="flex flex-1 flex-col">
      <PromptTop label={promptLabel(prompt, "Vote")} timer={<TimerChip seconds={secondsLeft} />} />
      <h2 className="font-display mt-6 text-[clamp(52px,15vw,76px)] lg:text-[clamp(72px,7.5vw,128px)]">{prompt.question}</h2>
      <div className={`mt-auto grid gap-5 pt-8 ${prompt.options.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
        {prompt.options.map((opt, i) => {
          const mine = voted === i;
          const p = voted !== undefined || !open ? pct(stats, i) : null;
          return (
            <button
              key={i}
              type="button"
              disabled={!canVote}
              onClick={() => onAnswer({ option: i })}
              className={`relative flex min-h-[84px] items-center gap-4 overflow-hidden rounded-[16px] px-6 py-4 text-left lg:min-h-[120px] lg:px-9 ${
                mine ? "bg-ink text-yellow shadow-[8px_8px_0_var(--red)]" : "border-[3px] border-ink bg-card text-ink"
              }`}
            >
              {!mine && p != null && (
                <span aria-hidden className="absolute inset-y-0 left-0 border-r-2 border-dashed border-ink bg-paper" style={{ width: `${p}%` }} />
              )}
              <KeyCap k={String(i + 1)} dark={mine} />
              <span className="font-display relative flex-1 text-[clamp(36px,11vw,48px)] lg:text-[60px]">
                {mine && <span className="font-sans font-normal">✓ </span>}
                {opt}
              </span>
              {p != null && <span className="font-mono relative text-[24px] font-semibold tabular lg:text-[30px]">{p}%</span>}
            </button>
          );
        })}
      </div>
      <Foot>
        {voted !== undefined ? (
          <>
            You voted{answer?.pending ? " · saving…" : ` · +${answer?.result?.points ?? VOTE_POINTS}`} · {host} sees the split{" "}
            {open && secondsLeft ? `in ${clock(secondsLeft)}` : "now"}
          </>
        ) : open ? (
          `Vote for +${VOTE_POINTS}`
        ) : (
          "Voting closed"
        )}
        {answer?.error && <span className="block text-red">{answer.error}</span>}
      </Foot>
    </div>
  );
}

// ---- Predict ----

export function PredictScreen({ prompt, answer, stats, secondsLeft, open, onAnswer }: PromptProps) {
  const locked = answer?.option;
  const [pick, setPick] = useState<number | null>(null);
  const chosen = locked ?? pick;
  const canPick = open && locked === undefined;
  const lock = () => {
    if (canPick && pick !== null) onAnswer({ option: pick });
  };
  useKeys(setPick, prompt.options.length, canPick, { onEnter: lock });
  const label = (i: number) => prompt.options[i] ?? String(i + 1);

  return (
    <div className="flex flex-1 flex-col">
      <PromptTop label={promptLabel(prompt, "Predict")} timer={<TimerChip seconds={secondsLeft} tone="ink" />} />
      <h2 className="font-display mt-6 text-[clamp(52px,15vw,76px)] lg:text-[clamp(72px,7.5vw,128px)]">{prompt.question}</h2>
      <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-5 lg:mt-10 lg:grid-cols-6">
        {prompt.options.map((_, i) => {
          const sel = chosen === i;
          return (
            <button
              key={i}
              type="button"
              disabled={!canPick}
              aria-pressed={sel}
              onClick={() => setPick(i)}
              className={`relative grid aspect-[4/3] place-items-center rounded-[14px] lg:aspect-[9/10] ${
                sel ? "border-[3px] border-ink bg-card text-ink shadow-[8px_8px_0_var(--red)]" : "bg-ink text-yellow disabled:opacity-90"
              }`}
            >
              {!sel && (
                <>
                  <span aria-hidden className={`absolute top-1/2 size-6 -translate-y-1/2 rounded-full bg-page lg:hidden ${i % 2 ? "-right-3" : "-left-3"}`} />
                  <span aria-hidden className="absolute -top-3 left-1/2 hidden size-6 -translate-x-1/2 rounded-full bg-page lg:block" />
                </>
              )}
              <span className="flex flex-col items-center">
                <span className="font-wide text-[56px] leading-none lg:text-[80px]">{label(i)}</span>
                {sel && <span className="font-label mt-3 font-semibold">{locked !== undefined ? "Locked" : "Your pick"}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-auto flex flex-col gap-4 pt-8 lg:flex-row lg:items-center lg:gap-8">
        <Button
          onClick={lock}
          disabled={!canPick || pick === null}
          className="lg:w-auto lg:min-w-[380px]"
        >
          {locked !== undefined ? `BOX ${label(locked)} LOCKED ✓` : chosen !== null ? `LOCK BOX ${label(chosen)}` : open ? "PICK A BOX" : "CLOSED"}
          <span className="hidden font-sans text-[0.7em] lg:inline">{canPick && pick !== null ? "↵" : ""}</span>
        </Button>
        <p aria-live="polite" className="text-center font-mono text-[14px] leading-snug lg:text-left lg:text-[15px]">
          {n(stats?.answered ?? 0)} predictions locked · amounts sealed before anyone picked
          {prompt.round_id && (
            <>
              {" · "}
              <Link href={`/verify/${prompt.round_id}`} className="underline underline-offset-4">
                how we prove it
              </Link>
            </>
          )}
          {locked !== undefined && !open && <span className="block">Waiting for the reveal… +{PREDICT_POINTS} if you called it.</span>}
          {answer?.pending && <span className="block">Saving your pick…</span>}
          {answer?.error && <span className="block text-red">{answer.error}</span>}
        </p>
      </div>
    </div>
  );
}

// ---- Quiz ----

const QUIZ_IDLE =
  "border-[3px] border-[color-mix(in_srgb,var(--ink)_45%,var(--yellow))] bg-[color-mix(in_srgb,var(--card)_50%,var(--yellow))] text-[color-mix(in_srgb,var(--ink)_55%,var(--yellow))]";

export function QuizScreen({ prompt, answer, secondsLeft, open, onAnswer }: PromptProps) {
  const chose = answer?.option;
  const canAnswer = open && chose === undefined;
  useKeys((i) => onAnswer({ option: i }), prompt.options.length, canAnswer, { letters: true });

  const m = /Q\s*(\d+)\s*of\s*(\d+)/i.exec(prompt.label ?? "");
  const duration = prompt.duration_seconds ?? 15;
  const progress = m ? Number(m[1]) / Number(m[2]) : secondsLeft != null ? 1 - secondsLeft / duration : 0;
  const r = answer?.result;
  const revealed = prompt.correct_option;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-5 h-3 overflow-hidden rounded-full bg-ink" aria-hidden>
        <div className="h-full bg-red transition-[width] duration-500" style={{ width: `${Math.min(1, Math.max(0, progress)) * 100}%` }} />
      </div>
      <PromptTop label={promptLabel(prompt, "Quick-fire")} timer={<TimerChip seconds={secondsLeft} tone="plain" />} />
      <h2 className="font-display mt-6 text-[clamp(44px,13vw,64px)] lg:text-[clamp(64px,6.5vw,112px)]">{prompt.question}</h2>
      <div className="mt-auto grid gap-4 pt-8 lg:grid-cols-2 lg:gap-5">
        {prompt.options.map((opt, i) => {
          const mine = chose === i;
          const right = mine && r?.correct === true;
          const wrong = mine && r?.correct === false;
          const isAnswer = revealed === i && !mine;
          const look = right
            ? "border-[3px] border-ink bg-green text-ink"
            : wrong
              ? "border-[3px] border-ink bg-red text-paper"
              : mine
                ? "border-[3px] border-ink bg-ink text-yellow"
                : isAnswer
                  ? "border-[3px] border-green bg-card text-ink"
                  : QUIZ_IDLE;
          return (
            <button
              key={i}
              type="button"
              disabled={!canAnswer}
              onClick={() => onAnswer({ option: i })}
              className={`flex min-h-[60px] items-center gap-5 rounded-[14px] px-6 py-3 text-left lg:min-h-[100px] lg:px-9 ${look}`}
            >
              <span className="w-6 font-mono text-[18px] font-semibold lg:grid lg:size-9 lg:place-items-center lg:rounded-md lg:border-2 lg:border-current">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="font-wide min-w-0 flex-1 text-[clamp(22px,7vw,30px)] leading-tight lg:text-[40px]">{opt}</span>
              {mine && (
                <span aria-live="polite" className="font-mono text-[17px] font-semibold whitespace-nowrap lg:text-[20px]">
                  {answer?.pending
                    ? "Saving…"
                    : r
                      ? `${r.correct ? "✓" : "✗"} +${r.points} · ${(r.elapsed_ms / 1000).toFixed(1)}s`
                      : answer?.error
                        ? "Not saved"
                        : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <Foot>
        {answer?.error ? <span className="text-red">{answer.error}</span> : "Same question the stranger is answering on the street"}
      </Foot>
    </div>
  );
}

// ---- Text (Name the Song) — dark ----

export function TextScreen({ prompt, answer, stats, secondsLeft, open, onAnswer }: PromptProps) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const sent = answer?.text !== undefined;
  const r = answer?.result;

  return (
    <div className="flex flex-1 flex-col">
      <PromptTop label={promptLabel(prompt, "Music")} timer={<TimerChip seconds={secondsLeft} />} dark />
      <h2 className="font-display mt-6 text-[clamp(52px,15vw,76px)] text-yellow lg:text-[clamp(72px,7.5vw,128px)]">{prompt.question}</h2>
      <p className="mt-5 text-[19px] leading-snug text-paper/80 lg:text-[24px]">Listen on the Live. First 10 correct answers score double.</p>

      {sent ? (
        <div aria-live="polite" className={`mt-auto rounded-[16px] px-6 py-5 ${r?.correct ? "bg-green text-ink" : "bg-coal text-paper"}`}>
          <p className="font-label">You said</p>
          <p className="font-wide mt-1 text-[26px] leading-tight">
            {answer.text}
            {answer.artist ? ` · ${answer.artist}` : ""}
          </p>
          <p className="mt-2 font-mono text-[18px] font-semibold">
            {answer.pending
              ? "Saving…"
              : r
                ? r.correct
                  ? `✓ +${r.points} · ${(r.elapsed_ms / 1000).toFixed(1)}s`
                  : r.correct === false
                    ? "✗ Not this time. Listen for the next one."
                    : "Answer saved. Wait for the reveal."
                : (answer.error ?? "")}
          </p>
        </div>
      ) : (
        <form
          className="mt-auto grid gap-5 pt-8 lg:grid-cols-[1.3fr_1fr_auto] lg:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (open && title.trim()) onAnswer({ text: title.trim(), artist: artist.trim() || undefined });
          }}
        >
          <label className="block">
            <span className="font-label mb-2.5 block text-paper/80">Song title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 120))}
              autoComplete="off"
              disabled={!open}
              className="h-[64px] w-full rounded-[14px] border-[3px] border-yellow bg-paper px-6 text-[26px] font-bold text-ink outline-none"
            />
          </label>
          <label className="block">
            <span className="font-label mb-2.5 block text-paper/80">Artist · Bonus +{ARTIST_BONUS}</span>
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value.slice(0, 120))}
              placeholder="Optional"
              autoComplete="off"
              disabled={!open}
              className="h-[64px] w-full rounded-[14px] border-[3px] border-smoke bg-coal px-6 text-[24px] text-paper outline-none placeholder:text-ash/60 focus:border-yellow"
            />
          </label>
          <Button type="submit" variant="yellow" disabled={!open || !title.trim()} className="lg:h-[64px] lg:w-auto lg:min-w-[200px]">
            <span className="lg:hidden">
              SEND ANSWER <Arrow />
            </span>
            <span className="hidden lg:inline">SEND ↵</span>
          </Button>
        </form>
      )}
      <Foot>
        <span className="text-paper/80">
          {n(stats?.answered ?? 0)} answered · {n(stats?.correct ?? 0)} correct so far
        </span>
      </Foot>
    </div>
  );
}

// ---- Result (after a prediction is revealed) ----

export function ResultScreen({
  prompt,
  answer,
  stats,
  me,
  nextStartsAt,
}: {
  prompt: LivePrompt;
  answer: Answer;
  stats: PromptStats | null;
  me: FanStanding | null;
  nextStartsAt: string | null;
}) {
  const correct = prompt.correct_option != null && answer.option === prompt.correct_option;
  const won = prompt.correct_option != null ? prompt.options[prompt.correct_option] ?? String(prompt.correct_option + 1) : null;
  const prize = /₦[\d,.]+\s*[kKmM]?/.exec(prompt.question)?.[0] ?? null;
  const share = stats && stats.answered ? Math.round((stats.correct / stats.answered) * 100) : null;
  const before = answer.rankBefore;
  const after = me?.rank;
  const moved = before && after && before !== after ? `#${before} → #${after}` : null;
  const next = useCountdown(nextStartsAt);

  return (
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-2 lg:items-center lg:gap-14">
      <div aria-live="polite">
        <Shout className="text-[clamp(48px,14vw,68px)] lg:text-[96px]">{correct ? "YOU CALLED AM!" : "NOT THIS TIME"}</Shout>
        <p className="font-display tabular mt-2 text-[clamp(140px,48vw,220px)] leading-[0.8] lg:text-[300px]">+{correct ? PREDICT_POINTS : 0}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {me && me.streak >= 2 && <span className="rounded-full bg-ink px-5 py-2 font-mono text-[17px] font-semibold text-yellow">{me.streak} in a row</span>}
          {share != null && (
            <span className="rounded-full border-2 border-ink bg-card px-5 py-2 font-mono text-[17px] font-semibold">
              {share < 50 ? `Only ${share}% got it` : `${share}% got it`}
            </span>
          )}
          {moved && <span className="rounded-full border-2 border-ink bg-card px-5 py-2 font-mono text-[17px] font-semibold">{moved}</span>}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-5 pt-10 lg:mt-0 lg:pt-0">
        {won != null && (
          <div className="relative rounded-[18px] bg-ink text-paper">
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5 lg:px-9 lg:pt-9">
              <div className="min-w-0">
                <p className="font-label text-[14px] text-paper/80">Box {won} had</p>
                {prize && <p className="font-display tabular text-[clamp(56px,17vw,80px)] text-yellow lg:text-[120px]">{prize}</p>}
                {prompt.reveal_note && <p className="mt-2 text-[17px] text-paper/80 lg:text-[22px]">{prompt.reveal_note}</p>}
              </div>
              <span className="font-wide text-[72px] leading-none text-yellow lg:text-[130px]">{won}</span>
            </div>
            <div className="relative mx-6 border-t-2 border-dashed border-smoke">
              <span aria-hidden className="absolute top-0 -left-[calc(1.5rem+14px)] size-7 -translate-y-1/2 rounded-full bg-page" />
              <span aria-hidden className="absolute top-0 -right-[calc(1.5rem+14px)] size-7 -translate-y-1/2 rounded-full bg-page" />
              <div className="flex items-center justify-between gap-4 py-4 font-mono text-[16px] lg:text-[18px]">
                <span className="text-paper/80">
                  <span className="lg:hidden">Seed check</span>
                  <span className="hidden lg:inline">Amounts sealed before anyone picked</span>
                </span>
                {prompt.round_id && (
                  <Link href={`/verify/${prompt.round_id}`} className="text-yellow underline underline-offset-4">
                    Verified ✓
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
        {next != null && next > 0 && (
          <p className="font-display hidden rounded-[14px] border-[3px] border-ink bg-card py-5 text-center text-[40px] lg:block" role="timer">
            NEXT ROUND STARTS IN {clock(next)}
          </p>
        )}
        {me && <MeBar me={me} extra={moved && after && before ? ` ${after < before ? "↑" : "↓"}${Math.abs(before - after)}` : undefined} />}
      </div>
    </div>
  );
}

// ---- Waiting ----

export function WaitingScreen({ state, me, host }: { state: LiveState | null; me: FanStanding | null; host: string }) {
  const left = useCountdown(state?.starts_at);
  const round = state?.round ? `Round ${state.round}` : "Next round";
  const format = state?.format ? FORMATS[state.format] : null;
  const note = state?.note ?? `${host} is setting up the next game.`;
  const counting = left != null && left > 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative rounded-[18px] bg-ink text-paper lg:grid lg:grid-cols-2">
        <div className="px-6 pt-7 pb-6 lg:px-12 lg:py-12">
          <p className="font-label text-[14px] text-yellow">{counting ? `${round} starts in` : `${round} · any moment`}</p>
          <p role="timer" className="font-display tabular mt-2 text-[clamp(96px,32vw,140px)] leading-[0.82] text-yellow lg:text-[200px]">
            {counting ? clock(left) : <span className="sp-pulse">0:00</span>}
          </p>
        </div>
        <div className="relative mx-6 border-t-2 border-dashed border-smoke lg:mx-0 lg:my-6 lg:border-t-0 lg:border-l-2">
          <span aria-hidden className="absolute top-0 -left-[calc(1.5rem+14px)] size-7 -translate-y-1/2 rounded-full bg-page lg:hidden" />
          <span aria-hidden className="absolute top-0 -right-[calc(1.5rem+14px)] size-7 -translate-y-1/2 rounded-full bg-page lg:hidden" />
          <span aria-hidden className="absolute -top-[calc(1.5rem+14px)] -left-3.5 hidden size-7 rounded-full bg-page lg:block" />
          <span aria-hidden className="absolute -bottom-[calc(1.5rem+14px)] -left-3.5 hidden size-7 rounded-full bg-page lg:block" />
          <div className="py-5 lg:flex lg:h-full lg:flex-col lg:justify-center lg:px-12">
            {format && <p className="font-wide text-[28px] leading-tight lg:text-[44px]">{format.name}</p>}
            <p className="mt-1 text-[18px] leading-snug text-paper/80 lg:text-[22px]">{note}</p>
          </div>
        </div>
      </div>

      <div className="mt-8 border-t-[3px] border-ink pt-6 lg:hidden">
        <Caption className="mb-2">How you score</Caption>
        {[
          ["Vote on the stranger's move", "+10"],
          ["Call the reveal right", "+100"],
          ["Fast right answer", "up to +150"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 border-b-2 border-ink py-4">
            <span className="font-wide text-[18px]">{k}</span>
            <span className="font-mono text-[20px] font-semibold whitespace-nowrap">{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-8 hidden grid-cols-3 rounded-[16px] border-[3px] border-ink lg:grid">
        {[
          ["+10", "Vote on the stranger's move"],
          ["+100", "Call the reveal right"],
          ["+150", "Fast right answer, at most"],
        ].map(([v, k], i) => (
          <div key={k} className={`px-9 py-7 ${i ? "border-l-[3px] border-ink" : ""}`}>
            <p className="font-display text-[80px]">{v}</p>
            <p className="font-wide mt-2 text-[20px]">{k}</p>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-8">
        {me && <MeBar me={me} />}
        <p className="hidden items-center gap-4 text-[19px] lg:flex">
          <span className="bg-ink px-4 py-1.5 font-mono text-[15px] text-yellow">TIP</span>
          Press <KbdBox>1</KbdBox> – <KbdBox>6</KbdBox> to answer from your keyboard.
        </p>
      </div>
    </div>
  );
}

const KbdBox = ({ children }: { children: ReactNode }) => (
  <kbd className="grid size-9 place-items-center rounded-md border-2 border-ink font-mono text-[17px] font-semibold">{children}</kbd>
);

