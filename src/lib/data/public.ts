import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentsProvider } from "@/lib/payments";
import { claimView, participantView, type ClaimView, type ParticipantView } from "@/lib/server/views";
import type { LiveSession, PublicEpisode, PublicEpisodePayout, PublicReceipt, PublicRound } from "@/types/domain";

// Server-side reads for public pages (receipts, verify, episode receipts,
// participant QR page, claim page, viewer page shell).

const num = <T extends object>(row: T, keys: (keyof T)[]): T => {
  const out = { ...row };
  for (const k of keys) (out[k] as unknown) = Number(out[k]);
  return out;
};

export async function getPublicReceipt(code: string): Promise<PublicReceipt | null> {
  if (!/^[A-Za-z2-9]{6}$/.test(code)) return null;
  const { data, error } = await createPublicClient().rpc("public_receipt", { p_code: code });
  if (error) throw error;
  const row = (data as PublicReceipt[])[0];
  return row ? num(row, ["amount"]) : null;
}

export async function getPublicRound(roundId: string): Promise<PublicRound | null> {
  if (!/^[0-9a-f-]{36}$/i.test(roundId)) return null;
  const { data, error } = await createPublicClient().rpc("public_round", { p_round: roundId });
  if (error) throw error;
  return (data as PublicRound[])[0] ?? null;
}

export async function getPublicEpisode(code: string): Promise<{ episode: PublicEpisode; payouts: PublicEpisodePayout[] } | null> {
  if (!/^[A-Za-z2-9]{6}$/.test(code)) return null;
  const client = createPublicClient();
  const [{ data: eps, error }, { data: payouts }] = await Promise.all([
    client.rpc("public_episode", { p_code: code }),
    client.rpc("public_episode_payouts", { p_code: code }),
  ]);
  if (error) throw error;
  const ep = (eps as PublicEpisode[])[0];
  if (!ep) return null;
  return {
    episode: num(ep, ["paid_total", "paid_count", "confirmed_count", "rounds_count", "seeds_revealed", "left_over"]),
    payouts: ((payouts ?? []) as PublicEpisodePayout[]).map((p) => num(p, ["amount"])),
  };
}

export async function getLiveSessionServer(handle: string): Promise<LiveSession | null> {
  const { data, error } = await createPublicClient().rpc("live_session", { p_handle: handle });
  if (error) throw error;
  const row = (data as LiveSession[])[0];
  return row ? { ...row, players: Number(row.players) } : null;
}

export async function getParticipantView(code: string): Promise<ParticipantView | null> {
  if (!/^[A-Za-z2-9]{6}$/.test(code)) return null;
  return participantView(createAdminClient(), code);
}

export async function getClaimView(code: string): Promise<ClaimView | null> {
  if (!/^[A-Za-z0-9]{6,8}$/.test(code)) return null;
  return claimView(createAdminClient(), code, Boolean(getPaymentsProvider().airtime));
}

/** Sponsor funding page header. */
export async function getFundingTarget(code: string) {
  if (!/^[A-Za-z2-9]{6}$/.test(code)) return null;
  const { data } = await createAdminClient()
    .from("episodes")
    .select("number, title, location, starts_at, status, sponsor_name, creator:creators(display_name, instagram_handle)")
    .eq("public_code", code.toUpperCase())
    .maybeSingle();
  return data as unknown as {
    number: number;
    title: string;
    location: string | null;
    starts_at: string | null;
    status: string;
    sponsor_name: string | null;
    creator: { display_name: string; instagram_handle: string | null };
  } | null;
}

export type { ClaimView, ParticipantView };
