// Budget step: split the day's budget across formats, and derive each
// format's prize settings from its share. Defaults reproduce the design:
// ₦500k over Ladder/Wheel/Lyric/Song → ₦200k/₦120k/₦100k/₦80k.

import type { FormatId, FormatPlan, FormatPlanEntry, Kobo } from "@/types/domain";
import { formatNaira, formatShort } from "@/lib/money";

const K = 100_000; // ₦1,000 in kobo

interface Defaults {
  weight: number;
  rounds: number;
}

const DEFAULTS: Partial<Record<FormatId, Defaults>> = {
  "money-ladder": { weight: 8, rounds: 5 },
  "spin-the-wheel": { weight: 4.8, rounds: 6 },
  "finish-the-lyric": { weight: 4, rounds: 8 },
  "name-the-song": { weight: 3.2, rounds: 8 },
  "pick-a-box": { weight: 4.8, rounds: 4 },
  "quickfire-trivia": { weight: 3.2, rounds: 5 },
};

const roundTo = (kobo: number, step: number) => Math.max(step, Math.round(kobo / step) * step);

/** Prize settings for one format from its amount and rounds. */
export function entryFor(format: FormatId, amount: Kobo, rounds: number): FormatPlanEntry {
  const per = amount / Math.max(1, rounds);
  switch (format) {
    case "money-ladder":
      return { amount, rounds, top: roundTo(per * 2, 5 * K), unit: roundTo((per * 2) / 16, 500 * 100) };
    case "spin-the-wheel":
      return { amount, rounds, top: roundTo(per * 2.5, 5 * K), unit: roundTo((per * 2.5) / 10, 500 * 100) };
    case "finish-the-lyric":
      return { amount, rounds, unit: roundTo(per, 500 * 100), top: roundTo(per, 500 * 100) * 3 };
    case "name-the-song":
      return { amount, rounds, unit: roundTo(per, 500 * 100), top: Math.round(roundTo(per, 500 * 100) * 1.5) };
    case "pick-a-box":
      return { amount, rounds, top: roundTo(per * 2, 5 * K), unit: roundTo(per / 5, 500 * 100) };
    case "quickfire-trivia":
      return { amount, rounds, unit: roundTo(per / 8, 500 * 100), top: roundTo(per / 8, 500 * 100) * 12 };
    default:
      return { amount, rounds, unit: roundTo(per, K), top: roundTo(per, K) };
  }
}

/** Splits a budget across formats by weight, rounded to ₦1,000. */
export function splitBudget(budget: Kobo, formats: FormatId[]): FormatPlan {
  const picked = formats.filter((f) => DEFAULTS[f]);
  const total = picked.reduce((s, f) => s + DEFAULTS[f]!.weight, 0);
  const plan: FormatPlan = {};
  let used = 0;
  picked.forEach((f, i) => {
    const amount = i === picked.length - 1 ? budget - used : Math.floor((budget * DEFAULTS[f]!.weight) / total / K) * K;
    used += amount;
    plan[f] = entryFor(f, amount, DEFAULTS[f]!.rounds);
  });
  return plan;
}

/** Largest single prize any format can pay, the default "max per payout". */
export function maxPrize(plan: FormatPlan): Kobo {
  return Math.max(0, ...Object.values(plan).map((e) => e!.top));
}

/** Default "hold to send above": ~60% of the max, rounded up to ₦10k. */
export function defaultConfirmAbove(max: Kobo): Kobo {
  return Math.ceil((max * 0.6) / (10 * K)) * 10 * K;
}

/** Budget row detail, e.g. "5 rounds · top rung ₦80,000". */
export function planDetail(format: FormatId, e: FormatPlanEntry): string {
  switch (format) {
    case "money-ladder":
      return `${e.rounds} rounds · top rung ${formatNaira(e.top)}`;
    case "spin-the-wheel":
      return `${e.rounds} spins · top slice ${formatNaira(e.top)}`;
    case "finish-the-lyric":
      return `${e.rounds} rounds · ${formatNaira(e.unit)} a line`;
    case "name-the-song":
      return `${e.rounds} rounds · ${formatNaira(e.unit)}`;
    case "pick-a-box":
      return `${e.rounds} rounds · top box ${formatNaira(e.top)}`;
    case "quickfire-trivia":
      return `${e.rounds} rounds · ${formatNaira(e.unit)} an answer`;
    default:
      return `${e.rounds} rounds`;
  }
}

/** Console card tag, e.g. "₦12.5k / line". */
export function planTag(format: FormatId, e: FormatPlanEntry | undefined): string {
  if (!e) return "";
  switch (format) {
    case "money-ladder":
      return `Starts ${formatShort(ladderRungs(e.top)[0])}`;
    case "spin-the-wheel":
      return "6 slices";
    case "finish-the-lyric":
      return `${formatShort(e.unit)} / line`;
    case "name-the-song":
      return `${formatShort(e.unit)} + artist`;
    case "pick-a-box":
      return `Top box ${formatShort(e.top)}`;
    case "quickfire-trivia":
      return `${formatShort(e.unit)} / answer`;
    default:
      return "";
  }
}

/** Five rungs doubling up to the top: ₦5k → ₦80k. */
export function ladderRungs(top: Kobo): Kobo[] {
  return [top / 16, top / 8, top / 4, top / 2, top].map((x) => Math.round(x / 100) * 100);
}
