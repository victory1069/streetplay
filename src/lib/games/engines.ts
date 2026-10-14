// Outcomes for the chance formats. Every random choice comes from the round's
// committed seed (lib/games/fairness), so /verify can replay it exactly.

import type { Kobo } from "@/types/domain";
import { seededRandom } from "./fairness";

export interface WheelSlice {
  label: string;
  kind: "cash" | "dare" | "sponsor";
  amount: Kobo;
}

/** Six slices like the design: top, small, mid, dare, sponsor (or cash), low. */
export function wheelSlices(top: Kobo, sponsorName?: string | null, sponsorAmount?: Kobo): WheelSlice[] {
  const r = (x: number) => Math.round(x / 50_000) * 50_000; // ₦500 steps
  return [
    { label: "top", kind: "cash", amount: top },
    { label: "small", kind: "cash", amount: r(top / 10) },
    { label: "mid", kind: "cash", amount: r(top * 0.4) },
    { label: "DARE", kind: "dare", amount: 0 },
    sponsorName
      ? { label: "SPONSOR", kind: "sponsor", amount: sponsorAmount ?? r(top / 5) }
      : { label: "low", kind: "cash", amount: r(top / 5) },
    { label: "low", kind: "cash", amount: r(top / 5) },
  ];
}

/** Which slice the seed lands on, plus how far to spin for the animation. */
export function spinOutcome(seed: string, sliceCount: number): { index: number; turns: number } {
  const rng = seededRandom(seed);
  const index = Math.floor(rng() * sliceCount);
  const turns = 5 + Math.floor(rng() * 3);
  return { index, turns };
}

/**
 * Hidden box amounts: exactly one top prize, the rest spread between a floor
 * and half the top, shuffled by the seed.
 */
export function boxAmounts(seed: string, count: number, top: Kobo, floor: Kobo): Kobo[] {
  const rng = seededRandom(seed);
  const step = 50_000;
  const others = Array.from({ length: count - 1 }, () => {
    const x = floor + rng() * (top / 2 - floor);
    return Math.max(step, Math.round(x / step) * step);
  });
  const all = [top, ...others];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}

/** Host's buyout offer for an unopened box: 80% of the average left. */
export function buyoutOffer(remaining: Kobo[]): Kobo {
  if (!remaining.length) return 0;
  const avg = remaining.reduce((s, x) => s + x, 0) / remaining.length;
  return Math.round((avg * 0.8) / 50_000) * 50_000;
}
