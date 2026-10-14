import { entryFor, ladderRungs } from "@/lib/games/plan";
import { wheelSlices } from "@/lib/games/engines";
import { formatShort } from "@/lib/money";
import type { Episode, FormatId, FormatPlanEntry, Kobo } from "@/types/domain";

/** Formats the host can play on the street today. */
export const PLAYABLE: FormatId[] = ["finish-the-lyric", "name-the-song", "money-ladder", "spin-the-wheel", "pick-a-box", "quickfire-trivia"];

export function planFor(episode: Episode, format: FormatId): FormatPlanEntry {
  return episode.format_plan[format] ?? entryFor(format, 0, 1);
}

/** Most this round can pay, from the episode's plan. */
export function prizeCapFor(format: FormatId, plan: FormatPlanEntry): Kobo {
  switch (format) {
    case "money-ladder":
    case "spin-the-wheel":
    case "pick-a-box":
      return plan.top;
    case "finish-the-lyric":
      return plan.unit * 3;
    case "name-the-song":
      return Math.round(plan.unit * 1.5);
    case "quickfire-trivia":
      return plan.unit * 12;
    default:
      return plan.top;
  }
}

export type RuleIcon = { kind: "check" } | { kind: "cross" } | { kind: "ring"; glyph: string };

export interface RulesCopy {
  headline: string;
  bullets: { icon: RuleIcon; text: string }[];
}

/** The rules card read to the stranger before play. */
export function rulesFor(format: FormatId, plan: FormatPlanEntry, sponsorName: string | null): RulesCopy {
  const unit = formatShort(plan.unit);
  switch (format) {
    case "money-ladder": {
      const r = ladderRungs(plan.top);
      return {
        headline: "Answer right, money doubles.",
        bullets: [
          { icon: { kind: "check" }, text: `Right: ${formatShort(r[0])} → ${formatShort(r[1])} → ${formatShort(r[2])}…` },
          { icon: { kind: "cross" }, text: "One wrong answer, you lose it" },
          { icon: { kind: "ring", glyph: "←" }, text: "Walk away any time with what you have" },
        ],
      };
    }
    case "finish-the-lyric":
      return {
        headline: "Music stops, you sing on.",
        bullets: [
          { icon: { kind: "check" }, text: `Every right line: ${unit}. Three lines max` },
          { icon: { kind: "cross" }, text: "Wrong line ends it. You keep what you won" },
          { icon: { kind: "ring", glyph: "10" }, text: "Ten seconds to sing each line" },
        ],
      };
    case "name-the-song":
      return {
        headline: "Name the song, catch the artist.",
        bullets: [
          { icon: { kind: "check" }, text: `Right title: ${unit}` },
          { icon: { kind: "ring", glyph: "+" }, text: `Artist too? Extra ${formatShort(Math.round(plan.unit / 2))}` },
          { icon: { kind: "cross" }, text: "Wrong or out of time, round over" },
        ],
      };
    case "quickfire-trivia":
      return {
        headline: "30 seconds. Answer fast, collect fast.",
        bullets: [
          { icon: { kind: "check" }, text: `Every right answer: ${unit}` },
          { icon: { kind: "cross" }, text: "Wrong? No stress, next question" },
          { icon: { kind: "ring", glyph: "30" }, text: "Clock stops at 30 seconds" },
        ],
      };
    case "spin-the-wheel": {
      const slices = wheelSlices(plan.top, sponsorName);
      const hasSponsor = slices.some((s) => s.kind === "sponsor");
      return {
        headline: "One spin decides your prize.",
        bullets: [
          { icon: { kind: "check" }, text: `Cash slices up to ${formatShort(plan.top)}${hasSponsor ? `, plus a ${sponsorName} slice` : ""}` },
          { icon: { kind: "ring", glyph: "!" }, text: `Land on DARE: do it and collect ${unit}` },
          { icon: { kind: "cross" }, text: "No second spin. The result is locked before you spin" },
        ],
      };
    }
    case "pick-a-box":
      return {
        headline: "Six boxes. One holds the big one.",
        bullets: [
          { icon: { kind: "check" }, text: `Every box has money. Top box: ${formatShort(plan.top)}` },
          { icon: { kind: "ring", glyph: "⇄" }, text: "I might offer you a swap, or cash to walk" },
          { icon: { kind: "cross" }, text: "Once the box opens, that's your prize" },
        ],
      };
    default:
      return { headline: "Let's play.", bullets: [] };
  }
}
