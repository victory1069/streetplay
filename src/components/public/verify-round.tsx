"use client";

import { useEffect, useState } from "react";
import { CheckDot } from "@/components/ui";
import { boxAmounts, spinOutcome, wheelSlices, type WheelSlice } from "@/lib/games/engines";
import { verifySeed } from "@/lib/games/fairness";
import { formatNaira, formatShortUpper } from "@/lib/money";
import type { PublicRound } from "@/types/domain";
import { groupHex } from "./display";

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && !isNaN(Number(v)) ? Number(v) : null);

/** Wheel slices from the round's result json (as played), else rebuilt from the top prize. */
function slicesFrom(result: Record<string, unknown>): WheelSlice[] | null {
  if (Array.isArray(result.slices)) {
    const s = (result.slices as unknown[])
      .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null))
      .filter((x): x is Record<string, unknown> => x !== null)
      .map((x) => ({ label: String(x.label ?? ""), kind: (x.kind as WheelSlice["kind"]) ?? "cash", amount: num(x.amount) ?? 0 }));
    if (s.length) return s;
  }
  const top = num(result.top);
  return top ? wheelSlices(top, typeof result.sponsor === "string" ? result.sponsor : null, num(result.sponsorAmount) ?? undefined) : null;
}

export function VerifyRound({ round }: { round: PublicRound }) {
  const [check, setCheck] = useState<boolean | null>(null);

  useEffect(() => {
    if (!round.seed || !round.commitment) return;
    let alive = true;
    verifySeed(round.seed, round.commitment).then((ok) => alive && setCheck(ok));
    return () => {
      alive = false;
    };
  }, [round.seed, round.commitment]);

  return (
    <div className="space-y-6">
      <section className="rounded-[16px] border-[3px] border-ink bg-card">
        <Block n="1" title="Lock (published before play)" body={round.commitment ? groupHex(round.commitment) : "No lock was recorded for this round."} />
        <Block
          n="2"
          title="Seed (revealed after the round)"
          body={round.seed ? groupHex(round.seed) : "Hidden until the round ends. Come back after."}
        />
        <div className="flex items-center gap-4 px-6 py-5" aria-live="polite">
          {check === null ? <CheckDot tone="empty" /> : check ? <CheckDot /> : <span className="grid size-12 shrink-0 place-items-center rounded-full bg-red text-xl text-paper">✕</span>}
          <span>
            <span className="font-wide block text-[20px] leading-tight">
              {!round.seed ? "Waiting for the reveal" : check === null ? "Checking in your browser…" : check ? "The seed matches the lock" : "The seed does NOT match the lock"}
            </span>
            <span className="mt-1 block font-mono text-[13px] text-muted">sha256(seed) worked out on this device, not our server</span>
          </span>
        </div>
      </section>

      {round.seed && <Replay round={round} seed={round.seed} />}
    </div>
  );
}

function Block({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="border-b-2 border-dashed border-ink px-6 py-5">
      <p className="font-label">
        {n} · {title}
      </p>
      <p className="mt-2 font-mono text-[15px] leading-relaxed break-all">{body}</p>
    </div>
  );
}

function Replay({ round, seed }: { round: PublicRound; seed: string }) {
  const result = round.result ?? {};
  if (round.format === "spin-the-wheel") {
    const slices = slicesFrom(result);
    if (!slices) return <NoReplay />;
    const { index } = spinOutcome(seed, slices.length);
    return (
      <section>
        <p className="font-label">3 · Replay the spin</p>
        <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {slices.map((s, i) => (
            <li
              key={i}
              className={`rounded-[12px] border-[3px] px-4 py-3 ${i === index ? "border-ink bg-yellow" : "border-ink/20 bg-card"}`}
              aria-current={i === index ? "true" : undefined}
            >
              <span className="font-label block">Slice {i + 1}</span>
              <span className="font-display block text-[34px]">{s.kind === "cash" ? formatShortUpper(s.amount) : s.label}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[17px]">
          This seed lands on slice {index + 1}: <b>{slices[index].kind === "cash" ? formatNaira(slices[index].amount) : slices[index].label}</b>.
        </p>
      </section>
    );
  }
  if (round.format === "pick-a-box") {
    const top = num(result.top);
    const count = num(result.count) ?? (Array.isArray(result.amounts) ? result.amounts.length : null) ?? 6;
    const floor = num(result.floor) ?? (top ? Math.round(top / 10 / 50_000) * 50_000 : 0);
    if (!top) return <NoReplay />;
    const amounts = boxAmounts(seed, count, top, floor);
    const picked = num(result.picked) ?? num(result.box);
    return (
      <section>
        <p className="font-label">3 · Replay the boxes</p>
        <ol className="mt-3 grid grid-cols-3 gap-2">
          {amounts.map((a, i) => (
            <li key={i} className={`rounded-[12px] border-[3px] px-3 py-3 text-center ${picked === i ? "border-ink bg-yellow" : "border-ink/20 bg-card"}`}>
              <span className="font-label block">Box {i + 1}</span>
              <span className="font-display block text-[30px]">{formatShortUpper(a)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[17px]">These amounts were fixed by the seed before anyone picked a box.</p>
      </section>
    );
  }
  return (
    <p className="text-[17px] leading-snug text-muted">
      This format doesn&apos;t use a random draw, so there&apos;s nothing to replay. The lock still shows the round was set up before play.
    </p>
  );
}

function NoReplay() {
  return <p className="text-[17px] text-muted">The prize settings for this round weren&apos;t recorded, so we can&apos;t replay the draw here. The seed check above still holds.</p>;
}
