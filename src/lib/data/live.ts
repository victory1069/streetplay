// Live mode data for both sides: the host's Live control and the viewer
// page (anonymous). Keep the viewer-side functions light; that page has to
// load in under 2 seconds on 3G inside Instagram's browser.

import { createClient } from "@/lib/supabase/client";
import type {
  FanStanding,
  LeaderboardPeriod,
  LeaderboardRow,
  LivePrompt,
  LiveSession,
  PromptKind,
  PromptStats,
  RespondResult,
} from "@/types/domain";

// ---- Live control ----

export async function openPrompt(input: {
  episodeId: string;
  roundId?: string | null;
  roundNumber?: number | null;
  kind: PromptKind;
  question: string;
  options?: string[];
  label?: string;
  durationSeconds?: number;
  /** Hidden from viewers until the reveal: quiz answer index, or text answer + artist. */
  secret?: { correctOption?: number; answer?: string; artist?: string };
}): Promise<LivePrompt> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("live_prompts")
    .insert({
      episode_id: input.episodeId,
      round_id: input.roundId ?? null,
      round_number: input.roundNumber ?? null,
      kind: input.kind,
      question: input.question,
      options: input.kind === "text" ? [] : input.options ?? [],
      label: input.label ?? null,
      duration_seconds: input.durationSeconds ?? null,
      closes_at: input.durationSeconds ? new Date(Date.now() + input.durationSeconds * 1000).toISOString() : null,
    })
    .select()
    .single();
  if (error) throw error;
  if (input.secret) {
    const { error: e2 } = await supabase.from("live_prompt_secrets").insert({
      prompt_id: data.id,
      correct_option: input.secret.correctOption ?? null,
      answer: input.secret.answer ?? null,
      artist: input.secret.artist ?? null,
    });
    if (e2) throw e2;
  }
  return data as LivePrompt;
}

export async function closePrompt(promptId: string): Promise<void> {
  const { error } = await createClient().from("live_prompts").update({ status: "closed" }).eq("id", promptId);
  if (error) throw error;
}

/** Reveal. Predictions score now (+100). `correctOption` null for votes and text. */
export async function resolvePrompt(promptId: string, correctOption: number | null, note?: string): Promise<void> {
  const { error } = await createClient().rpc("resolve_prompt", { p_prompt: promptId, p_correct: correctOption, p_note: note ?? null });
  if (error) throw error;
}

export async function listPrompts(episodeId: string, limit = 20): Promise<LivePrompt[]> {
  const { data, error } = await createClient()
    .from("live_prompts")
    .select("*")
    .eq("episode_id", episodeId)
    .order("opened_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as LivePrompt[];
}

// ---- Both sides ----

/** Vote split and answer counts. Poll every second or two rather than streaming every vote. */
export async function getPromptStats(promptId: string): Promise<PromptStats> {
  const { data, error } = await createClient().rpc("prompt_stats", { p_prompt: promptId });
  if (error) throw error;
  const s = data as { answered: number; correct: number; options: number[] };
  return { answered: Number(s.answered), correct: Number(s.correct), options: (s.options ?? []).map(Number) };
}

export async function getLiveSession(handle: string): Promise<LiveSession | null> {
  const { data, error } = await createClient().rpc("live_session", { p_handle: handle });
  if (error) throw error;
  const row = (data as LiveSession[])[0];
  return row ? { ...row, players: Number(row.players) } : null;
}

export async function getLeaderboard(creatorId: string, episodeId: string | null, period: LeaderboardPeriod, limit = 20): Promise<LeaderboardRow[]> {
  const { data, error } = await createClient().rpc("live_leaderboard", {
    p_creator: creatorId,
    p_episode: episodeId,
    p_period: period,
    p_limit: limit,
  });
  if (error) throw error;
  return (data as LeaderboardRow[]).map((r) => ({ ...r, rank: Number(r.rank), points: Number(r.points) }));
}

export async function getCurrentPrompt(episodeId: string): Promise<LivePrompt | null> {
  const { data, error } = await createClient()
    .from("live_prompts")
    .select("*")
    .eq("episode_id", episodeId)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as LivePrompt | null;
}

/** New prompts, closes and reveals for an episode. Returns unsubscribe. */
export function subscribeToPrompts(episodeId: string, onChange: (prompt: LivePrompt) => void): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`prompts:${episodeId}:${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "live_prompts", filter: `episode_id=eq.${episodeId}` }, (payload) =>
      onChange(payload.new as LivePrompt),
    )
    .subscribe();
  return () => void supabase.removeChannel(channel);
}

// ---- Viewer ----

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message ?? `Error ${res.status}`), { status: res.status });
  return data as T;
}

export const joinLive = (handle: string, displayName: string) =>
  call<FanStanding>(`/api/live/${encodeURIComponent(handle)}/join`, { method: "POST", body: JSON.stringify({ displayName }) });

/** Throws with status 401 when this browser hasn't joined yet. */
export const getMyStanding = (handle: string) => call<FanStanding>(`/api/live/${encodeURIComponent(handle)}/me`);

export const respond = (handle: string, promptId: string, answer: { option?: number; text?: string; artist?: string }) =>
  call<RespondResult>(`/api/live/${encodeURIComponent(handle)}/respond`, { method: "POST", body: JSON.stringify({ promptId, ...answer }) });

/** "Don't miss the next Live": web push subscription. Returns false if unsupported or denied. */
export async function subscribeToCreator(handle: string): Promise<boolean> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if ((await Notification.requestPermission()) !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
  await call("/api/push/subscribe", { method: "POST", body: JSON.stringify({ handle, subscription: sub.toJSON() }) });
  return true;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
