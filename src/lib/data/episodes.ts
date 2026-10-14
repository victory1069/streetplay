// Episodes, rounds, consent and clip markers. Client-side; RLS-protected.
// Game writes (rounds, consents, markers) go through the offline sync queue,
// so a round can be started, played and logged with no signal.

import { createClient } from "@/lib/supabase/client";
import { cached, idb } from "@/lib/offline/idb";
import { enqueueWrite } from "@/lib/offline/sync";
import { commitSeed, generateSeed } from "@/lib/games/fairness";
import type {
  ClipMarker,
  Consent,
  Episode,
  FormatId,
  FormatPlan,
  Kobo,
  LiveState,
  Payout,
  Round,
  RoundStatus,
} from "@/types/domain";

export const RELEASE_VERSION = "2026-10-v1";

export async function listEpisodes(creatorId: string): Promise<Episode[]> {
  return cached(`episodes:${creatorId}`, async () => {
    const { data, error } = await createClient()
      .from("episodes")
      .select("*")
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Episode[];
  });
}

export async function getEpisode(id: string): Promise<Episode | null> {
  return cached(`episode:${id}`, async () => {
    const { data, error } = await createClient().from("episodes").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as Episode | null;
  });
}

export interface EpisodeInput {
  creatorId: string;
  title: string;
  location?: string;
  startsAt?: string | null;
  formats: FormatId[];
  packIds: string[];
  budget: Kobo;
  formatPlan: FormatPlan;
  maxPayout: Kobo;
  confirmAbove: Kobo;
  repeatPolicy: Episode["repeat_policy"];
  sponsorName?: string | null;
}

export async function createEpisode(input: EpisodeInput): Promise<Episode> {
  const { data, error } = await createClient()
    .from("episodes")
    .insert({
      creator_id: input.creatorId,
      title: input.title.trim(),
      location: input.location?.trim() || null,
      starts_at: input.startsAt ?? null,
      formats: input.formats,
      pack_ids: input.packIds,
      budget: input.budget,
      format_plan: input.formatPlan,
      max_payout: input.maxPayout,
      confirm_above: input.confirmAbove,
      repeat_policy: input.repeatPolicy,
      sponsor_name: input.sponsorName ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Episode;
}

export async function updateEpisode(
  id: string,
  patch: Partial<
    Pick<
      Episode,
      "title" | "location" | "starts_at" | "formats" | "pack_ids" | "budget" | "format_plan" | "max_payout" | "confirm_above" | "repeat_policy" | "sponsor_name"
    >
  >,
): Promise<void> {
  const { error } = await createClient().from("episodes").update(patch).eq("id", id);
  if (error) throw error;
}

/** Status → live and pings fans who asked to be told. */
export async function goLive(id: string): Promise<Episode> {
  const res = await fetch(`/api/episodes/${id}/go-live`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message);
  return data as Episode;
}

export async function wrapEpisode(id: string): Promise<void> {
  const { error } = await createClient()
    .from("episodes")
    .update({ status: "wrapped", wrapped_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** What viewers see between rounds ("Round 3 starts in 0:24 · Money Ladder"). */
export async function setLiveState(episodeId: string, state: LiveState): Promise<void> {
  const { error } = await createClient().from("episodes").update({ live_state: state }).eq("id", episodeId);
  if (error) throw error;
}

/** Live updates to one episode row (status, live state). Returns unsubscribe. */
export function subscribeToEpisode(episodeId: string, onChange: (episode: Episode) => void): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`episode:${episodeId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "episodes", filter: `id=eq.${episodeId}` }, (payload) =>
      onChange(payload.new as Episode),
    )
    .subscribe();
  return () => void supabase.removeChannel(channel);
}

// ---- Rounds (offline-first) ----

/**
 * Starts a round with a fairness commitment. Returns at once; the row syncs
 * when the network allows. The seed is stored with the round (owner-only until
 * it ends) and must hash to the commitment, which the database enforces.
 */
export async function startRound(input: {
  id?: string;
  episodeId: string;
  format: FormatId;
  prizeCap: Kobo;
  participantName?: string | null;
}): Promise<Round> {
  // Same id twice (double tap, Enter + tap): keep the first round and its
  // seed. A second seed would break the public fair-play check.
  if (input.id) {
    const existing = await idb.get<Round>("rounds", input.id).catch(() => undefined);
    if (existing) return existing;
  }
  const seed = generateSeed();
  const now = new Date().toISOString();
  const round: Round = {
    id: input.id ?? crypto.randomUUID(),
    episode_id: input.episodeId,
    number: null,
    format: input.format,
    status: "playing",
    prize_cap: input.prizeCap,
    prize_won: 0,
    participant_name: input.participantName ?? null,
    commitment: await commitSeed(seed),
    seed,
    summary: null,
    result: {},
    started_at: now,
    ended_at: null,
    created_at: now,
  };
  await idb.put("rounds", round);
  await enqueueWrite("rounds", "insert", round.id, {
    episode_id: round.episode_id,
    format: round.format,
    status: round.status,
    prize_cap: round.prize_cap,
    prize_won: 0,
    participant_name: round.participant_name,
    commitment: round.commitment,
    seed: round.seed,
    started_at: round.started_at,
  });
  return round;
}

/** Local copy first (works offline), then the server's (has the round number). */
export async function getRound(id: string): Promise<Round | null> {
  const local = await idb.get<Round>("rounds", id).catch(() => undefined);
  try {
    const { data } = await createClient().from("rounds").select("*").eq("id", id).maybeSingle();
    if (data) {
      const merged = { ...(data as Round), ...(local && local.status !== "playing" ? { status: local.status, prize_won: local.prize_won, result: local.result, summary: local.summary } : {}) };
      await idb.put("rounds", merged);
      return merged;
    }
  } catch {
    /* offline */
  }
  return local ?? null;
}

/** Saves in-progress game state (rung reached, lines right…) without ending the round. */
export async function saveRoundProgress(round: Round, result: Record<string, unknown>, prizeWon: Kobo): Promise<Round> {
  const next = { ...round, result, prize_won: prizeWon };
  await idb.put("rounds", next);
  await enqueueWrite("rounds", "update", round.id, { result, prize_won: prizeWon });
  return next;
}

export async function endRound(
  round: Round,
  status: Exclude<RoundStatus, "setup" | "playing">,
  prizeWon: Kobo,
  summary: string,
  result: Record<string, unknown> = round.result,
): Promise<Round> {
  const next: Round = { ...round, status, prize_won: prizeWon, summary, result, ended_at: new Date().toISOString() };
  await idb.put("rounds", next);
  await enqueueWrite("rounds", "update", round.id, {
    status,
    prize_won: prizeWon,
    summary,
    result,
    ended_at: next.ended_at,
  });
  return next;
}

export async function listRounds(episodeId: string): Promise<Round[]> {
  const { data, error } = await createClient().from("rounds").select("*").eq("episode_id", episodeId).order("created_at");
  if (error) throw error;
  return data as Round[];
}

export async function recordConsent(roundId: string, nameGiven: string): Promise<void> {
  const id = crypto.randomUUID();
  await enqueueWrite("consents", "insert", id, {
    round_id: roundId,
    name_given: nameGiven.trim(),
    release_version: RELEASE_VERSION,
    agreed_at: new Date().toISOString(),
  });
}

export async function addClipMarker(episodeId: string, label: ClipMarker["label"], roundId?: string | null): Promise<void> {
  await enqueueWrite("clip_markers", "insert", crypto.randomUUID(), {
    episode_id: episodeId,
    round_id: roundId ?? null,
    label,
    at: new Date().toISOString(),
  });
}

// ---- Episode log + export ----

export interface EpisodeLog {
  episode: Episode;
  rounds: Round[];
  payouts: Payout[];
  consents: Consent[];
  markers: ClipMarker[];
}

export async function getEpisodeLog(episodeId: string): Promise<EpisodeLog> {
  const supabase = createClient();
  const [ep, rounds, payouts, markers] = await Promise.all([
    supabase.from("episodes").select("*").eq("id", episodeId).single(),
    supabase.from("rounds").select("*").eq("episode_id", episodeId).order("created_at"),
    supabase.from("payouts").select("*").eq("episode_id", episodeId).order("created_at"),
    supabase.from("clip_markers").select("*").eq("episode_id", episodeId).order("at"),
  ]);
  if (ep.error) throw ep.error;
  const roundIds = (rounds.data ?? []).map((r) => r.id);
  const consents = roundIds.length
    ? await supabase.from("consents").select("*").in("round_id", roundIds).order("agreed_at")
    : { data: [] as Consent[] };
  return {
    episode: ep.data as Episode,
    rounds: (rounds.data ?? []) as Round[],
    payouts: (payouts.data ?? []) as Payout[],
    consents: (consents.data ?? []) as Consent[],
    markers: (markers.data ?? []) as ClipMarker[],
  };
}

/** Money and round counts for headers ("₦412,000 budget left · 7 rounds · 6 paid"). */
export function episodeTotals(log: Pick<EpisodeLog, "episode" | "rounds" | "payouts">) {
  const live = log.payouts.filter((p) => ["held", "sending", "sent"].includes(p.status));
  const sent = log.payouts.filter((p) => p.status === "sent");
  const spent = live.reduce((s, p) => s + p.amount, 0);
  return {
    spent,
    paidTotal: sent.reduce((s, p) => s + p.amount, 0),
    paidCount: sent.length,
    budgetLeft: Math.max(0, log.episode.budget - spent),
    rounds: log.rounds.length,
  };
}

/** Clip list for the editor (CSV). */
export function clipMarkersCsv(log: EpisodeLog): string {
  const roundById = new Map(log.rounds.map((r) => [r.id, r]));
  const rows = [["time", "label", "round", "format", "participant", "payout"]];
  for (const m of log.markers) {
    const r = m.round_id ? roundById.get(m.round_id) : undefined;
    const p = r ? log.payouts.find((x) => x.round_id === r.id && x.status === "sent") : undefined;
    rows.push([m.at, m.label, r?.number ? `R${r.number}` : "", r?.format ?? "", r?.participant_name ?? "", p ? String(p.amount / 100) : ""]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

/** Payouts + consents (CSV). The printable PDF lives at /studio/episodes/[id]/log/print. */
export function episodeLogCsv(log: EpisodeLog): string {
  const rows = [["round", "format", "status", "participant", "consent_at", "amount_naira", "recipient", "receipt", "payout_status", "paid_at"]];
  for (const r of log.rounds) {
    const c = log.consents.find((x) => x.round_id === r.id);
    const ps = log.payouts.filter((p) => p.round_id === r.id);
    if (!ps.length) rows.push([`R${r.number ?? ""}`, r.format, r.status, r.participant_name ?? "", c?.agreed_at ?? "", "", "", "", "", ""]);
    for (const p of ps) {
      rows.push([`R${r.number ?? ""}`, r.format, r.status, r.participant_name ?? "", c?.agreed_at ?? "", String(p.amount / 100), p.recipient_display ?? "", p.receipt_code, p.status, p.sent_at ?? ""]);
    }
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
