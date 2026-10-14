import type { FormatId } from "@/types/domain";

export interface FormatDefinition {
  id: FormatId;
  name: string;
  phase: "mvp" | "v2";
  /** One line the host can read to a stranger: "understand the game in 10 seconds". */
  pitch: string;
  usesRandomness: boolean;
  liveTieIn: "vote" | "predict" | "answer" | "guess";
}

// Registry of game templates. Screens look formats up here by id.
export const FORMATS: Record<FormatId, FormatDefinition> = {
  "finish-the-lyric": {
    id: "finish-the-lyric",
    name: "Finish the Lyric",
    phase: "mvp",
    pitch: "I stop the song, you sing the next line.",
    usesRandomness: false,
    liveTieIn: "guess",
  },
  "name-the-song": {
    id: "name-the-song",
    name: "Name the Song",
    phase: "mvp",
    pitch: "Name the title. Bonus if you get the artist too.",
    usesRandomness: false,
    liveTieIn: "guess",
  },
  "money-ladder": {
    id: "money-ladder",
    name: "Money Ladder",
    phase: "mvp",
    pitch: "Every right answer doubles it. One wrong and it's gone. Walk away any time.",
    usesRandomness: false,
    liveTieIn: "vote",
  },
  "pick-a-box": {
    id: "pick-a-box",
    name: "Pick a Box",
    phase: "mvp",
    pitch: "Pick one box. Every box has money; one has the big one.",
    usesRandomness: true,
    liveTieIn: "predict",
  },
  "spin-the-wheel": {
    id: "spin-the-wheel",
    name: "Spin the Wheel",
    phase: "mvp",
    pitch: "One spin decides your prize.",
    usesRandomness: true,
    liveTieIn: "vote",
  },
  "quickfire-trivia": {
    id: "quickfire-trivia",
    name: "Quick-fire Trivia",
    phase: "mvp",
    pitch: "30 seconds. Money for every right answer.",
    usesRandomness: false,
    liveTieIn: "answer",
  },
  "this-or-that": {
    id: "this-or-that",
    name: "This or That",
    phase: "v2",
    pitch: "Take the cash now, or gamble on the mystery offer.",
    usesRandomness: false,
    liveTieIn: "predict",
  },
  "price-check": {
    id: "price-check",
    name: "Price Check",
    phase: "v2",
    pitch: "Guess the market price. Closest wins.",
    usesRandomness: false,
    liveTieIn: "answer",
  },
  "dare-timer": {
    id: "dare-timer",
    name: "Dare Timer",
    phase: "v2",
    pitch: "Do the dare before the clock runs out.",
    usesRandomness: false,
    liveTieIn: "vote",
  },
  "crowd-decides": {
    id: "crowd-decides",
    name: "Crowd Decides",
    phase: "v2",
    pitch: "The Live audience decides your prize.",
    usesRandomness: false,
    liveTieIn: "vote",
  },
};

export const MVP_FORMATS = Object.values(FORMATS).filter((f) => f.phase === "mvp");
