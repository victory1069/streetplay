// Glue between the host's game screens and the viewer page. When an episode
// is live, game screens call these so viewers get the matching question
// without the host typing anything. All are no-ops when not live, and
// failures never interrupt the game (it must never slow the moment down).

import { openPrompt, resolvePrompt, closePrompt } from "@/lib/data/live";
import { setLiveState } from "@/lib/data/episodes";
import type { Episode, FormatId, LivePrompt, Question, Round, SongCard } from "@/types/domain";

const quiet = async <T>(fn: () => Promise<T>): Promise<T | null> => {
  try {
    return await fn();
  } catch (err) {
    console.warn("live sync skipped", err);
    return null;
  }
};

const isLive = (ep: Pick<Episode, "status">) => ep.status === "live";

/** Waiting screen: "Round 3 starts in 0:24 · Money Ladder". */
export function announceNextRound(ep: Episode, format: FormatId, roundNumber: number, note?: string) {
  if (!isLive(ep)) return Promise.resolve(null);
  return quiet(() =>
    setLiveState(ep.id, {
      round: roundNumber,
      format,
      starts_at: new Date(Date.now() + 30_000).toISOString(),
      note: note ?? "The host is walking up to the next stranger.",
    }),
  );
}

/** Money Ladder between rungs: "Walk away or go again?" (vote, +10). */
export function openLadderVote(ep: Episode, round: Round, roundNumber: number, onAmount: string) {
  if (!isLive(ep)) return Promise.resolve(null);
  return quiet(() =>
    openPrompt({
      episodeId: ep.id,
      roundId: round.id,
      roundNumber,
      kind: "vote",
      label: `Round ${roundNumber} · Vote`,
      question: `She's on ${onAmount}. Comot or carry go?`,
      options: ["Walk away", "Go again"],
      durationSeconds: 20,
    }),
  );
}

/** Pick a Box: "Which box holds ₦50,000?" (predict, +100 at the reveal). */
export function openBoxPrediction(ep: Episode, round: Round, roundNumber: number, boxes: number, topLabel: string) {
  if (!isLive(ep)) return Promise.resolve(null);
  return quiet(() =>
    openPrompt({
      episodeId: ep.id,
      roundId: round.id,
      roundNumber,
      kind: "predict",
      label: `Round ${roundNumber} · Predict`,
      question: `Which box holds ${topLabel}?`,
      options: Array.from({ length: boxes }, (_, i) => String(i + 1)),
      durationSeconds: 30,
    }),
  );
}

/** Same trivia question the stranger is answering (quiz, up to +150 for speed). */
export function openQuizQuestion(ep: Episode, round: Round, roundNumber: number, q: Question, label: string) {
  if (!isLive(ep) || !q.choices?.length) return Promise.resolve(null);
  return quiet(() =>
    openPrompt({
      episodeId: ep.id,
      roundId: round.id,
      roundNumber,
      kind: "quiz",
      label,
      question: q.prompt,
      options: q.choices!.slice(0, 4),
      durationSeconds: 15,
      secret: { correctOption: q.choices!.indexOf(q.answer) },
    }),
  );
}

/** Name the Song: viewers type the title (+artist bonus). No lyrics ever. */
export function openSongGuess(ep: Episode, round: Round, roundNumber: number, song: SongCard) {
  if (!isLive(ep)) return Promise.resolve(null);
  return quiet(() =>
    openPrompt({
      episodeId: ep.id,
      roundId: round.id,
      roundNumber,
      kind: "text",
      label: `Round ${roundNumber} · Music`,
      question: "Name the song before she does.",
      durationSeconds: 30,
      secret: { answer: song.title, artist: song.artist },
    }),
  );
}

/** Reveal (predictions score here). `correct` null for votes/text. */
export function revealPrompt(prompt: LivePrompt | null, correct: number | null, note?: string) {
  if (!prompt) return Promise.resolve(null);
  return quiet(() => resolvePrompt(prompt.id, correct, note));
}

export function closeLivePrompt(prompt: LivePrompt | null) {
  if (!prompt) return Promise.resolve(null);
  return quiet(() => closePrompt(prompt.id));
}
