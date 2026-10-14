"use client";

import { useEffect, useState } from "react";
import { getEpisodeLog, type EpisodeLog } from "@/lib/data/episodes";
import { FORMATS } from "@/lib/games/formats";
import type { Round } from "@/types/domain";

/** Loads the episode log once. `error` holds a message to show. */
export function useEpisodeLog(episodeId: string): { log: EpisodeLog | null; error: string | null } {
  const [state, setState] = useState<{ log: EpisodeLog | null; error: string | null }>({ log: null, error: null });
  useEffect(() => {
    let alive = true;
    getEpisodeLog(episodeId)
      .then((log) => alive && setState({ log, error: null }))
      .catch((e) => alive && setState({ log: null, error: e instanceof Error ? e.message : "Couldn't load this episode." }));
    return () => {
      alive = false;
    };
  }, [episodeId]);
  return state;
}

/** "R9 Money Ladder" (+ " · 2 lines" when the round has a summary). */
export function roundLine(r: Round | undefined | null, withSummary = true): string {
  if (!r) return "Viewer prize";
  const name = FORMATS[r.format]?.name ?? r.format;
  const head = `${r.number ? `R${r.number} ` : ""}${name}`;
  if (!withSummary || !r.summary) return head;
  return r.summary.toLowerCase().startsWith(name.toLowerCase()) ? `${r.number ? `R${r.number} ` : ""}${r.summary}` : `${head} · ${r.summary}`;
}

export const MARKER_NAMES: Record<string, string> = { funny: "Funny", "big-win": "Big win", reaction: "Reaction" };

/** Payouts that count as paid or on their way. */
export const LIVE_PAYOUT = ["held", "sending", "sent"];
