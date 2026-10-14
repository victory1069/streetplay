// Host-side payout helpers. Sending money goes through the offline outbox
// (lib/offline/outbox.enqueuePayout); these cover lookup, status,
// the participant QR handoff and viewer prizes.

import { createClient } from "@/lib/supabase/client";
import { cached } from "@/lib/offline/idb";
import type { AccountRequest, Kobo, Payout } from "@/types/domain";
import type { Bank, NameEnquiryResult } from "@/lib/payments/types";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);
  return data as T;
}

/** Bank list, cached for offline use (keypad screen works without signal). */
export async function listBanks(): Promise<Bank[]> {
  return cached("banks", async () => {
    const res = await fetch("/api/banks");
    if (!res.ok) throw new Error("Couldn't load banks");
    return res.json();
  });
}

/** Banks shown as chips first on the keypad screen. */
export const POPULAR_BANK_CODES = ["058", "999992", "044", "50515"];

export function bankName(banks: Bank[], code: string | null | undefined): string {
  return banks.find((b) => b.code === code)?.name ?? "Bank";
}

/** Resolve the account holder's name to show in big type on camera. */
export const nameEnquiry = (accountNumber: string, bankCode: string) =>
  postJson<NameEnquiryResult>("/api/payouts/name-enquiry", { accountNumber, bankCode });

export async function getPayout(id: string): Promise<Payout | null> {
  const { data } = await createClient().from("payouts").select("*").eq("id", id).maybeSingle();
  return data as Payout | null;
}

export async function getPayoutByKey(idempotencyKey: string): Promise<Payout | null> {
  const { data } = await createClient().from("payouts").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
  return data as Payout | null;
}

export async function listPayouts(episodeId: string): Promise<Payout[]> {
  const { data, error } = await createClient()
    .from("payouts")
    .select("*")
    .eq("episode_id", episodeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Payout[];
}

/** Status changes for an episode's payouts (sent, failed). */
export function subscribeToPayouts(episodeId: string, onChange: (payout: Payout) => void): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`payouts:${episodeId}:${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "payouts", filter: `episode_id=eq.${episodeId}` }, (payload) =>
      onChange(payload.new as Payout),
    )
    .subscribe();
  return () => void supabase.removeChannel(channel);
}

/** How many times this account has been paid on the creator's show (repeat-winner warning). */
export async function previousWins(creatorId: string, accountNumber: string): Promise<number> {
  const { count } = await createClient()
    .from("payouts")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .eq("account_number", accountNumber)
    .eq("status", "sent");
  return count ?? 0;
}

// ---- Participant QR handoff (/p/[code]) ----

/** Show `${origin}/p/${code}` as a QR; wait on subscribeToAccountRequest. */
export async function createAccountRequest(input: {
  episodeId: string;
  roundId: string | null;
  amount: Kobo;
  participantName: string | null;
}): Promise<AccountRequest> {
  const { data, error } = await createClient()
    .from("account_requests")
    .insert({ episode_id: input.episodeId, round_id: input.roundId, amount: input.amount, participant_name: input.participantName })
    .select()
    .single();
  if (error) throw error;
  return data as AccountRequest;
}

export async function getAccountRequest(token: string): Promise<AccountRequest | null> {
  const { data } = await createClient().from("account_requests").select("*").eq("token", token).maybeSingle();
  return data as AccountRequest | null;
}

export function subscribeToAccountRequest(token: string, onChange: (req: AccountRequest) => void): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`account-request:${token}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "account_requests", filter: `token=eq.${token}` }, (payload) =>
      onChange(payload.new as AccountRequest),
    )
    .subscribe();
  return () => void supabase.removeChannel(channel);
}

// ---- Viewer prizes ----

/** Top N on this Live's board each win `amount`, claimable for 24 hours. */
export async function createViewerPrizes(episodeId: string, amount: Kobo, top = 3): Promise<{ created: Payout[] }> {
  const res = await postJson<{ created: Payout[]; error?: string }>("/api/live/prizes", { episodeId, amount, top });
  // 207: some prizes were created, then one failed (e.g. not enough in the wallet).
  if (res.error) {
    throw new Error(`${res.created.length} prize${res.created.length === 1 ? "" : "s"} created, then it stopped: ${res.error === "insufficient_balance" ? "not enough in the wallet." : res.error}`);
  }
  return res;
}
