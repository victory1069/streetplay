"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCountdown } from "@/components/ui/interactive";
import { seededRandom } from "@/lib/games/fairness";
import { ladderRungs } from "@/lib/games/plan";
import { closeLivePrompt, openLadderVote, openQuizQuestion, revealPrompt } from "@/lib/live/auto";
import { formatNaira } from "@/lib/money";
import type { LivePrompt, Question } from "@/types/domain";
import { GameShell, GameTop, Hint, RightWrong, seededOrder, TimerChip, type GameProps } from "./shared";
import { roundSeed } from "./song-games";

type QuestionProps = GameProps & { questions: Question[] };

function useQuestionDeck(questions: Question[], seed: string): Question[] {
  return useMemo(() => seededOrder(questions, seededRandom(seed)), [questions, seed]);
}

/**
 * Starts a deadline shortly after mount (no Date.now() during render). A
 * deadline saved in the round resumes instead, so refreshing mid-question
 * doesn't hand the contestant a fresh clock. `onStart` persists a new one.
 */
function useDeadlineOnMount(
  seconds: number,
  saved?: number,
  onStart?: (at: number) => void,
): [number | null, (at: number | null) => void] {
  const [endsAt, setEndsAt] = useState<number | null>(saved ?? null);
  useEffect(() => {
    if (saved) return;
    const t = window.setTimeout(() => {
      const at = Date.now() + seconds * 1000;
      setEndsAt(at);
      onStart?.(at);
    }, 0);
    return () => window.clearTimeout(t);
    // Mount only: later deadlines are set by the game's own handlers.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [endsAt, setEndsAt];
}

function QuestionText({ q }: { q: Question | undefined }) {
  if (!q) return <p className="font-display mt-5 text-[40px] text-paper/50">Out of questions. Add a pack.</p>;
  return (
    <>
      <h2 className="font-display mt-5 text-[clamp(40px,12.5vw,56px)] break-words">{q.prompt}</h2>
      <p className="mt-3 font-mono text-[14px] text-ash">
        <span className="opacity-70">Answer · </span>
        {q.answer}
      </p>
    </>
  );
}

// ---------------------------------------------------------------- Money Ladder

const LADDER_SECONDS = 30;
/** Event-handler clock read, kept out of render. */
const deadline = (seconds: number) => Date.now() + seconds * 1000;

export function MoneyLadder({ episode, round, plan, roundNumber, onEnd, onSave, questions }: QuestionProps) {
  const deck = useQuestionDeck(questions, roundSeed(round));
  const rungs = ladderRungs(plan.top);
  const saved = round.result as { rung?: number; q?: number; endsAt?: number };
  const [rung, setRung] = useState(saved.rung ?? 0); // index of the rung being played
  const [qi, setQi] = useState(saved.q ?? 0);
  const [endsAt, setEndsAt] = useDeadlineOnMount(LADDER_SECONDS, saved.endsAt, (at) =>
    onSave({ rung, q: qi, stage: "play", endsAt: at }, rung > 0 ? rungs[rung - 1] : 0),
  );
  const left = useCountdown(endsAt);
  const vote = useRef<LivePrompt | null>(null);
  const q = deck[qi];
  const banked = rung > 0 ? rungs[rung - 1] : 0;
  const asked = () => deck.slice(0, qi + 1).map((x) => x.id);

  const right = () => {
    void closeLivePrompt(vote.current);
    vote.current = null;
    if (rung >= rungs.length - 1) {
      onEnd("won", rungs[rungs.length - 1], "top rung", { rung: rungs.length, asked: asked() });
      return;
    }
    const next = rung + 1;
    setRung(next);
    setQi(qi + 1);
    const at = deadline(LADDER_SECONDS);
    setEndsAt(at);
    onSave({ rung: next, q: qi + 1, stage: "play", endsAt: at }, rungs[next - 1]);
    void openLadderVote(episode, round, roundNumber ?? 0, formatNaira(rungs[next - 1])).then((p) => (vote.current = p));
  };
  const wrong = () => {
    void closeLivePrompt(vote.current);
    onEnd("lost", 0, `wrong at rung ${rung + 1}`, { rung: rung + 1, lostAt: rungs[rung], asked: asked() });
  };
  const walk = () => {
    void closeLivePrompt(vote.current);
    onEnd("walked-away", banked, "walked", { rung, walkedWith: banked, asked: asked() });
  };
  const undo = () => {
    if (rung === 0) return;
    setRung(rung - 1);
    setQi(qi - 1);
    const at = deadline(LADDER_SECONDS);
    setEndsAt(at);
    onSave({ rung: rung - 1, q: qi - 1, stage: "play", endsAt: at }, rung - 1 > 0 ? rungs[rung - 2] : 0);
  };

  return (
    <GameShell
      bottom={
        <>
          <RightWrong onRight={right} onWrong={wrong} onUndo={undo} disabled={!q} />
          <button
            type="button"
            onClick={walk}
            disabled={banked === 0}
            className="font-wide mt-3 flex min-h-[52px] w-full items-center justify-center rounded-[12px] border-2 border-paper text-[17px] uppercase disabled:opacity-30"
          >
            Walk away with {formatNaira(banked)}
          </button>
        </>
      }
    >
      <GameTop
        roundNumber={roundNumber}
        name="Money Ladder"
        episodeId={episode.id}
        roundId={round.id}
        right={<TimerChip seconds={left} />}
      />
      <QuestionText q={q} />
      <ol className="mt-auto flex flex-col-reverse gap-1.5 pt-6" aria-label="Ladder">
        {rungs.map((amount, i) => {
          const passed = i < rung;
          const current = i === rung;
          return (
            <li
              key={i}
              aria-current={current ? "step" : undefined}
              className={`font-display relative flex items-center justify-between rounded-[10px] px-4 tabular ${
                current
                  ? "min-h-[56px] bg-yellow text-[34px] text-ink"
                  : passed
                    ? "min-h-[44px] border-2 border-green text-[26px] text-green"
                    : "min-h-[44px] border-2 border-smoke text-[26px] text-muted"
              }`}
            >
              {current && (
                <>
                  <span aria-hidden className="absolute top-1/2 -left-2 size-4 -translate-y-1/2 rounded-full bg-page" />
                  <span aria-hidden className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 rounded-full bg-page" />
                </>
              )}
              <span>
                {i + 1}
                {passed && <span className="ml-1 font-sans font-light">✓</span>}
              </span>
              <span>{formatNaira(amount)}</span>
            </li>
          );
        })}
      </ol>
      <Hint>Long-press to undo</Hint>
    </GameShell>
  );
}

// ---------------------------------------------------------------- Quick-fire Trivia

const QUICKFIRE_SECONDS = 30;
const QUIZ_COUNT = 10;
const opened = new Set<string>();

export function QuickfireTrivia({ episode, round, plan, roundNumber, onEnd, onSave, questions, prizeCap }: QuestionProps & { prizeCap: number }) {
  const deck = useQuestionDeck(questions, roundSeed(round));
  const saved = round.result as { right?: number; q?: number; endsAt?: number };
  const [right, setRight] = useState(saved.right ?? 0);
  const [qi, setQi] = useState(saved.q ?? 0);
  const [history, setHistory] = useState<boolean[]>([]);
  const [endsAt] = useDeadlineOnMount(QUICKFIRE_SECONDS, saved.endsAt, (at) =>
    onSave({ right, q: qi, stage: "play", endsAt: at }, Math.min(prizeCap, right * plan.unit)),
  );
  const left = useCountdown(endsAt);
  const prompt = useRef<LivePrompt | null>(null);
  const q = deck[qi];
  const timeUp = left !== null && left <= 0;
  const prize = Math.min(prizeCap, right * plan.unit);

  const label = (i: number) => `Q${i + 1} of ${QUIZ_COUNT} · Quick-fire`;
  const openFor = (i: number) => {
    const next = deck[i];
    if (!next || i >= QUIZ_COUNT) return;
    void openQuizQuestion(episode, round, roundNumber ?? 0, next, label(i)).then((p) => (prompt.current = p));
  };
  const revealCurrent = () => {
    const prev = prompt.current;
    prompt.current = null;
    if (prev && q?.choices) void revealPrompt(prev, q.choices.slice(0, 4).indexOf(q.answer));
  };

  useEffect(() => {
    const key = `${round.id}:${qi}`;
    if (opened.has(key)) return;
    opened.add(key);
    openFor(qi);
    // First question goes to viewers when the clock starts.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (n: number) => {
    revealCurrent();
    const won = Math.min(prizeCap, n * plan.unit);
    onEnd(won > 0 ? "won" : "lost", won, `${n} right`, { right: n, asked: deck.slice(0, qi + 1).map((x) => x.id) });
  };

  const answer = (ok: boolean) => {
    const n = ok ? right + 1 : right;
    if (n * plan.unit >= prizeCap) return finish(n);
    revealCurrent();
    setRight(n);
    setQi(qi + 1);
    setHistory([...history, ok]);
    onSave({ right: n, q: qi + 1, stage: "play", endsAt: endsAt ?? undefined }, Math.min(prizeCap, n * plan.unit));
    openFor(qi + 1);
  };
  const undo = () => {
    const last = history.at(-1);
    if (last === undefined) return;
    const n = last ? right - 1 : right;
    setHistory(history.slice(0, -1));
    setRight(n);
    setQi(qi - 1);
    onSave({ right: n, q: qi - 1, stage: "play", endsAt: endsAt ?? undefined }, n * plan.unit);
  };

  return (
    <GameShell
      bottom={
        timeUp || !q ? (
          <button
            type="button"
            onClick={() => finish(right)}
            className="font-display flex min-h-[80px] w-full items-center justify-center gap-3 rounded-[14px] bg-yellow text-[36px] text-ink active:scale-[0.98]"
          >
            {prize > 0 ? `Finish · ${formatNaira(prize)}` : "Finish"} <span className="font-sans font-normal">→</span>
          </button>
        ) : (
          <>
            <RightWrong onRight={() => answer(true)} onWrong={() => answer(false)} onUndo={undo} />
            <Hint>Long-press to undo · every tap is the next question</Hint>
          </>
        )
      }
    >
      <GameTop
        roundNumber={roundNumber}
        name="Quick-fire Trivia"
        episodeId={episode.id}
        roundId={round.id}
        right={<TimerChip seconds={left} />}
      />
      {timeUp ? (
        <p className="font-display mt-8 text-[clamp(80px,28vw,130px)] text-red" aria-live="assertive">
          Time!
        </p>
      ) : (
        <QuestionText q={q} />
      )}
      <div className="mt-auto pt-6 text-center" aria-live="polite">
        <p className="font-display tabular text-[clamp(80px,26vw,120px)] leading-[0.82] text-yellow">{right}</p>
        <p className="mt-2 font-mono text-[16px] text-paper/80">
          {right} right · {formatNaira(prize)}
        </p>
      </div>
    </GameShell>
  );
}
