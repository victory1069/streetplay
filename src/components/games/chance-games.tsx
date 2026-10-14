"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HoldButton } from "@/components/ui/interactive";
import { buttonClass } from "@/components/ui";
import { boxAmounts, buyoutOffer, spinOutcome, wheelSlices, type WheelSlice } from "@/lib/games/engines";
import { openBoxPrediction, revealPrompt } from "@/lib/live/auto";
import { formatNaira, formatShortUpper } from "@/lib/money";
import { timeWAT } from "@/lib/format";
import type { LivePrompt } from "@/types/domain";
import { GameShell, GameTop, type GameProps } from "./shared";
import { roundSeed } from "./song-games";

const SPIN_MS = 4200;

function SeedLine({ round }: { round: GameProps["round"] }) {
  const c = round.commitment ?? "";
  return (
    <p className="text-center font-mono text-[14px] text-paper/75">
      Seed locked {timeWAT(round.started_at)} · {c.slice(0, 4)}…{c.slice(-4)}
    </p>
  );
}

// ---------------------------------------------------------------- Spin the Wheel

function sliceFill(s: WheelSlice, i: number) {
  if (s.kind === "sponsor") return { bg: "var(--blue)", fg: "var(--paper)" };
  return i % 2 === 0 ? { bg: "var(--coal)", fg: "var(--yellow)" } : { bg: "var(--yellow)", fg: "var(--ink)" };
}

function Wheel({ slices, rotation, animate }: { slices: WheelSlice[]; rotation: number; animate: boolean }) {
  const n = slices.length;
  const seg = 360 / n;
  const R = 96;
  const pt = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(Math.cos(a) * r).toFixed(3)} ${(Math.sin(a) * r).toFixed(3)}`;
  };
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <svg viewBox="-12 -12 24 20" aria-hidden className="absolute -top-3 left-1/2 z-10 w-9 -translate-x-1/2">
        <path d="M-12 -12 L12 -12 L0 8 Z" fill="var(--red)" />
      </svg>
      <div
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: animate ? `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.7, 0.2, 1)` : "none",
        }}
      >
        <svg viewBox="-100 -100 200 200" className="block w-full" role="img" aria-label="Prize wheel">
          <circle r="99" fill="var(--yellow)" />
          {slices.map((s, i) => {
            const start = i * seg - seg / 2;
            const end = start + seg;
            const { bg, fg } = sliceFill(s, i);
            const label = s.kind === "cash" ? formatShortUpper(s.amount) : s.label;
            return (
              <g key={i}>
                <path d={`M0 0 L${pt(start, R)} A${R} ${R} 0 0 1 ${pt(end, R)} Z`} fill={bg} />
                <text
                  transform={`rotate(${i * seg - seg / 2}) translate(0 -58) rotate(90)`}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={fg}
                  className="font-display"
                  style={{ fontSize: label.length > 6 ? 17 : 22 }}
                >
                  {label}
                </text>
              </g>
            );
          })}
          <circle r="17" fill="var(--ink)" stroke="var(--yellow)" strokeWidth="3" />
          <text textAnchor="middle" dominantBaseline="central" fill="var(--yellow)" className="font-wide" style={{ fontSize: 12 }}>
            SP
          </text>
        </svg>
      </div>
    </div>
  );
}

export function SpinTheWheel({ episode, round, plan, roundNumber, onEnd, onSave }: GameProps) {
  const slices = useMemo(() => wheelSlices(plan.top, episode.sponsor_name), [plan.top, episode.sponsor_name]);
  const outcome = useMemo(() => spinOutcome(roundSeed(round), slices.length), [round, slices.length]);
  const seg = 360 / slices.length;
  // Slice i is centred at (i·seg − seg/2) clockwise from the top; rotate it under the pointer.
  const finalRotation = outcome.turns * 360 - (outcome.index * seg - seg / 2);
  const resumed = (round.result as { spun?: boolean }).spun === true;
  const [phase, setPhase] = useState<"ready" | "spinning" | "landed">(resumed ? "landed" : "ready");
  const slice = slices[outcome.index];

  const spin = () => {
    if (phase !== "ready") return;
    setPhase("spinning");
    onSave({ spun: true, stage: "play" }, 0);
    window.setTimeout(() => {
      setPhase("landed");
      navigator.vibrate?.([40, 60, 40]);
    }, SPIN_MS + 100);
  };

  const result = { slices, index: outcome.index, top: plan.top, sponsor: episode.sponsor_name ?? null, kind: slice.kind, amount: slice.amount, turns: outcome.turns };
  const payCash = () =>
    onEnd(
      "won",
      slice.amount,
      slice.kind === "sponsor" ? `${episode.sponsor_name ?? "Sponsor"} slice` : `${formatShortUpper(slice.amount)} slice`,
      result,
    );

  let bottom;
  if (phase !== "landed") {
    bottom = (
      <>
        <SeedLine round={round} />
        <HoldButton
          onComplete={spin}
          ms={700}
          disabled={phase === "spinning"}
          className={buttonClass({ variant: "yellow", className: "mt-3 min-h-[76px] text-[34px]" })}
        >
          {phase === "spinning" ? "Spinning…" : "Hold + flick to spin"}
        </HoldButton>
      </>
    );
  } else if (slice.kind === "dare") {
    bottom = (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onEnd("lost", 0, "Dare · refused", { ...result, dare: "fail" })}
          className="font-display flex min-h-[80px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-red text-[34px] text-paper"
        >
          ✕ No
        </button>
        <button
          type="button"
          onClick={() => onEnd("won", plan.unit, "Dare", { ...result, dare: "pass", amount: plan.unit })}
          className="font-display flex min-h-[80px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-green text-[34px] text-ink"
        >
          ✓ Did it
        </button>
      </div>
    );
  } else {
    bottom = (
      <button type="button" onClick={payCash} className={buttonClass({ variant: "yellow", className: "min-h-[76px] text-[34px]" })}>
        Pay {formatNaira(slice.amount)} <span className="font-sans font-normal">→</span>
      </button>
    );
  }

  return (
    <GameShell bottom={bottom}>
      <GameTop roundNumber={roundNumber} name="Spin the Wheel" episodeId={episode.id} roundId={round.id} />
      {phase === "landed" ? (
        <div className="mt-5" aria-live="assertive">
          {slice.kind === "dare" ? (
            <>
              <h2 className="font-display text-[clamp(72px,24vw,110px)] text-yellow">Dare!</h2>
              <p className="font-wide mt-2 text-[18px]">Do it on camera for {formatNaira(plan.unit)}.</p>
            </>
          ) : (
            <>
              <p className="font-label text-[13px] text-yellow">{slice.kind === "sponsor" ? `${episode.sponsor_name ?? "Sponsor"} slice` : "You landed"}</p>
              <h2 className="font-display mt-1 text-[clamp(72px,24vw,110px)] text-yellow tabular">{formatNaira(slice.amount)}</h2>
            </>
          )}
        </div>
      ) : (
        <h2 className="font-display mt-5 text-[clamp(44px,14vw,62px)]">One spin. Wetin you go get?</h2>
      )}
      <div className="flex flex-1 items-center py-6">
        <Wheel slices={slices} rotation={phase === "ready" ? 0 : finalRotation} animate={phase === "spinning"} />
      </div>
    </GameShell>
  );
}

// ---------------------------------------------------------------- Pick a Box

const BOXES = 6;
const announcedBoxes = new Set<string>();

type BoxState = { pick?: number; swapped?: boolean; took?: number; open?: boolean; promptId?: string };

export function PickABox({ episode, round, plan, roundNumber, onEnd, onSave }: GameProps) {
  const amounts = useMemo(() => boxAmounts(roundSeed(round), BOXES, plan.top, plan.unit), [round, plan.top, plan.unit]);
  const topIndex = amounts.indexOf(Math.max(...amounts));
  const saved = round.result as BoxState;
  const [s, setS] = useState<BoxState>({ pick: saved.pick, swapped: saved.swapped, took: saved.took, open: saved.open, promptId: saved.promptId });
  const [swapping, setSwapping] = useState(false);
  const offer = buyoutOffer(amounts);

  // Latest state for async callbacks (the prompt can come back after a pick).
  const latest = useRef(s);
  const update = (next: BoxState) => {
    latest.current = next;
    setS(next);
    onSave({ ...next, stage: "play" }, 0);
  };
  const reveal = (promptId: string) =>
    void revealPrompt({ id: promptId } as LivePrompt, topIndex, `Box ${topIndex + 1} had ${formatNaira(plan.top)}`);

  useEffect(() => {
    if (announcedBoxes.has(round.id) || saved.promptId) return;
    announcedBoxes.add(round.id);
    void openBoxPrediction(episode, round, roundNumber ?? 0, BOXES, formatNaira(plan.top)).then((p) => {
      if (!p) return;
      // Save the id at once, so a reload neither opens a second prediction nor loses the reveal.
      update({ ...latest.current, promptId: p.id });
      if (latest.current.open) reveal(p.id);
    });
    // Viewers predict once, as the boxes go down.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (took?: number) => {
    const next = { ...s, open: true, took };
    update(next);
    // Viewers predicted which box holds the top prize: that's the right answer.
    if (s.promptId) reveal(s.promptId);
  };

  const tap = (i: number) => {
    if (s.open) return;
    if (s.pick === undefined) update({ ...s, pick: i });
    else if (swapping && i !== s.pick) {
      setSwapping(false);
      update({ ...s, pick: i, swapped: true });
    }
  };

  const pick = s.pick;
  const prize = s.took ?? (pick !== undefined ? amounts[pick] : 0);
  const finish = () =>
    onEnd("won", prize, s.took !== undefined ? `took ${formatShortUpper(s.took)}` : `Box ${pick! + 1} · ${formatShortUpper(prize)}`, {
      count: BOXES,
      top: plan.top,
      floor: plan.unit,
      amounts,
      picked: pick,
      swapped: !!s.swapped,
      took: s.took ?? null,
    });

  let headline: string;
  if (s.open) headline = s.took !== undefined ? `Took ${formatNaira(s.took)}.` : `Box ${pick! + 1}: ${formatNaira(amounts[pick!])}!`;
  else if (swapping) headline = "Swap to which box?";
  else if (pick === undefined) headline = "Pick one box.";
  else headline = `Box ${pick + 1}. Open or take the cash?`;

  let bottom;
  if (s.open) {
    bottom = (
      <button type="button" onClick={finish} className={buttonClass({ variant: "yellow", className: "min-h-[76px] text-[34px]" })}>
        Pay {formatNaira(prize)} <span className="font-sans font-normal">→</span>
      </button>
    );
  } else if (pick === undefined || swapping) {
    bottom = (
      <p className="pb-2 text-center font-mono text-[14px] text-paper/75">
        {swapping ? (
          <button type="button" className="underline underline-offset-4" onClick={() => setSwapping(false)}>
            Keep box {pick! + 1}
          </button>
        ) : (
          `Every box has money · top box ${formatNaira(plan.top)}`
        )}
      </p>
    );
  } else {
    bottom = (
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => open()} className={buttonClass({ variant: "yellow", className: "min-h-[72px] text-[34px]" })}>
          Open the box
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={() => open(offer)} className={buttonClass({ variant: "outline-light", font: "bold", size: "md", className: "flex-[3]" })}>
            Take {formatNaira(offer)}
          </button>
          {!s.swapped && (
            <button type="button" onClick={() => setSwapping(true)} className={buttonClass({ variant: "outline-light", font: "bold", size: "md", className: "flex-[2]" })}>
              Swap
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <GameShell bottom={bottom}>
      <GameTop roundNumber={roundNumber} name="Pick a Box" episodeId={episode.id} roundId={round.id} />
      <h2 className="font-display mt-5 text-[clamp(44px,14vw,60px)]" aria-live="polite">
        {headline}
      </h2>
      <div className="mt-6 grid grid-cols-2 gap-3 pb-4">
        {amounts.map((amount, i) => {
          const picked = i === pick;
          const revealed = !!s.open;
          const notch = i % 2 === 0 ? "-left-3" : "-right-3";
          return (
            <button
              key={i}
              type="button"
              onClick={() => tap(i)}
              disabled={revealed || (pick !== undefined && !swapping)}
              aria-pressed={picked}
              aria-label={revealed ? `Box ${i + 1}: ${formatNaira(amount)}` : `Box ${i + 1}`}
              className={`relative flex min-h-[96px] flex-col items-center justify-center rounded-[14px] transition-transform disabled:cursor-default ${
                picked
                  ? revealed
                    ? "bg-yellow text-ink shadow-[6px_6px_0_var(--red)]"
                    : "border-[3px] border-ink bg-card text-ink shadow-[6px_6px_0_var(--red)]"
                  : revealed
                    ? "bg-coal text-paper/45"
                    : "bg-coal text-yellow active:scale-[0.97]"
              }`}
            >
              {!picked && <span aria-hidden className={`absolute top-1/2 ${notch} size-6 -translate-y-1/2 rounded-full bg-page`} />}
              {revealed ? (
                <>
                  <span className="font-label text-[11px]">Box {i + 1}</span>
                  <span className={`font-display tabular ${picked ? "text-[40px]" : "text-[30px]"}`}>{formatShortUpper(amount)}</span>
                </>
              ) : (
                <>
                  <span className="font-wide text-[44px] leading-none">{i + 1}</span>
                  {picked && <span className="font-label mt-2 text-[11px]">Their pick</span>}
                </>
              )}
            </button>
          );
        })}
      </div>
      {!s.open && <SeedLine round={round} />}
    </GameShell>
  );
}
