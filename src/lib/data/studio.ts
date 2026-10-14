// Studio data: the signed-in creator, wallet, KYC, custom questions.
// Client-side; RLS decides what each user can see.

import { createClient } from "@/lib/supabase/client";
import { cached } from "@/lib/offline/idb";
import type { Creator, Kobo, Profile, Question, WalletEntry, WalletSummary, Withdrawal } from "@/types/domain";

async function postJson<T>(url: string, body: unknown, method = "POST"): Promise<T> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);
  return data as T;
}

export interface StudioContext {
  userId: string;
  phone: string | null;
  creator: Creator;
  profile: Profile | null;
}

/** The signed-in creator's show. Null when signed in but not set up yet (show onboarding). */
export async function getStudioContext(): Promise<StudioContext | null> {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;
  return cached(`studio-context:${userId}`, async () => {
    const [{ data: creator }, { data: profile }] = await Promise.all([
      supabase.from("creators").select("*").eq("id", userId).maybeSingle<Creator>(),
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle<Profile>(),
    ]);
    if (!creator) return null;
    return { userId, phone: (claims?.claims?.phone as string) || null, creator, profile };
  });
}

export async function saveProfile(displayName: string): Promise<void> {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { error } = await supabase.from("profiles").upsert({ id: claims?.claims?.sub, display_name: displayName.trim() });
  if (error) throw error;
}

export async function createCreatorProfile(input: { displayName: string; handle: string }): Promise<void> {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const handle = input.handle.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9._]{2,30}$/.test(handle)) throw new Error("Handle can use letters, numbers, dots and underscores.");
  await saveProfile(input.displayName);
  const { error } = await supabase.from("creators").insert({
    id: claims?.claims?.sub,
    display_name: input.displayName.trim(),
    instagram_handle: handle,
  });
  if (error) throw new Error(error.code === "23505" ? "That handle is taken." : error.message);
}

export async function updatePayoutLimits(
  creatorId: string,
  limits: Partial<Pick<Creator, "limit_per_round" | "limit_per_episode" | "limit_per_day" | "confirm_above" | "allow_repeat_winners">>,
): Promise<void> {
  const { error } = await createClient().from("creators").update(limits).eq("id", creatorId);
  if (error) throw error;
}

// ---- Wallet ----

export async function getWalletSummary(creatorId: string): Promise<WalletSummary> {
  return cached(`wallet:${creatorId}`, async () => {
    const { data, error } = await createClient().rpc("wallet_summary", { p_creator: creatorId });
    if (error) throw error;
    const row = (data as { balance: number; assigned: number; free: number }[])[0];
    return { balance: Number(row.balance), assigned: Number(row.assigned), free: Number(row.free) };
  });
}

export type ActivityEntry = WalletEntry & {
  episode: { number: number; title: string } | null;
  payout: { recipient_display: string | null; round: { format: string; number: number | null } | null } | null;
};

export async function listWalletActivity(creatorId: string, limit = 100): Promise<ActivityEntry[]> {
  const { data, error } = await createClient()
    .from("wallet_entries")
    .select("*, episode:episodes(number, title), payout:payouts!wallet_entries_payout_fk(recipient_display, round:rounds(format, number))")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as ActivityEntry[];
}

/** Activity rows as designed: fees rolled up per episode ("Payout fees · Ep 11 · 31 transfers"). */
export function groupActivity(entries: ActivityEntry[]): (ActivityEntry | { kind: "fee-group"; episode: ActivityEntry["episode"]; amount: Kobo; count: number; created_at: string })[] {
  const out: ReturnType<typeof groupActivity> = [];
  const fees = new Map<string, { kind: "fee-group"; episode: ActivityEntry["episode"]; amount: Kobo; count: number; created_at: string }>();
  for (const e of entries) {
    if (e.kind === "fee") {
      const key = e.episode_id ?? "none";
      const g = fees.get(key);
      if (g) {
        g.amount += e.amount;
        g.count += 1;
      } else {
        const ng = { kind: "fee-group" as const, episode: e.episode, amount: e.amount, count: 1, created_at: e.created_at };
        fees.set(key, ng);
        out.push(ng);
      }
    } else out.push(e);
  }
  return out;
}

export async function setDefaultEpisode(creatorId: string, episodeId: string | null): Promise<void> {
  const { error } = await createClient().from("creators").update({ default_episode_id: episodeId }).eq("id", creatorId);
  if (error) throw error;
}

export const withdraw = (amount: Kobo, episodeId?: string) => postJson<Withdrawal>("/api/wallet/withdraw", { amount, episodeId });

/** Everything free (fee deducted), capped at `cap` if given. Use after a wrap. */
export const withdrawMax = (cap?: Kobo, episodeId?: string) =>
  postJson<Withdrawal>("/api/wallet/withdraw", { max: true, amount: cap, episodeId });

/** Mock provider only: pretend money arrived in the creator's account number. */
export const simulateTransferIn = (amount: Kobo, sender?: string) => postJson<{ reference: string }>("/api/wallet/simulate", { amount, sender });

/** Newest top-up/sponsor entry after a given time, for the "Wallet funded" screen. */
export async function latestFunding(creatorId: string, sinceIso: string): Promise<ActivityEntry | null> {
  const { data } = await createClient()
    .from("wallet_entries")
    .select("*, episode:episodes(number, title), payout:payouts!wallet_entries_payout_fk(recipient_display, round:rounds(format, number))")
    .eq("creator_id", creatorId)
    .in("kind", ["topup", "sponsor"])
    .gt("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ActivityEntry | null) ?? null;
}

export function subscribeToWallet(creatorId: string, onChange: () => void): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`wallet:${creatorId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "wallet_entries", filter: `creator_id=eq.${creatorId}` }, onChange)
    .subscribe();
  return () => void supabase.removeChannel(channel);
}

// ---- KYC ("Open your wallet") ----

export const kycBvn = (bvn: string) => postJson<{ last4: string; first3: string; name: string | null }>("/api/kyc", { step: "bvn", bvn });
export const kycReturnAccount = (accountNumber: string, bankCode: string) =>
  postJson<{ accountName: string }>("/api/kyc", { step: "return-account", accountNumber, bankCode });

export async function kycSubmit(bvn: string, selfie: Blob): Promise<"verified" | "pending"> {
  const form = new FormData();
  form.set("bvn", bvn);
  form.set("selfie", selfie, "selfie.jpg");
  const res = await fetch("/api/kyc/submit", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`);
  return data.kyc_status;
}

export const kycRefresh = () => postJson<{ kyc_status: Creator["kyc_status"] }>("/api/kyc", {}, "PUT");

// ---- Custom questions ("Write your own") ----

export async function listCustomQuestions(creatorId: string): Promise<Question[]> {
  const { data, error } = await createClient().from("custom_questions").select("*").eq("creator_id", creatorId).order("created_at");
  if (error) throw error;
  return (data as { id: string; prompt: string; answer: string; choices: string[] }[]).map((r) => ({
    id: r.id,
    prompt: r.prompt,
    answer: r.answer,
    choices: r.choices.length ? r.choices : undefined,
    difficulty: 1,
  }));
}

export async function addCustomQuestion(creatorId: string, q: { prompt: string; answer: string; choices?: string[] }): Promise<void> {
  const { error } = await createClient()
    .from("custom_questions")
    .insert({ creator_id: creatorId, prompt: q.prompt, answer: q.answer, choices: q.choices ?? [] });
  if (error) throw error;
}

export async function deleteCustomQuestion(id: string): Promise<void> {
  const { error } = await createClient().from("custom_questions").delete().eq("id", id);
  if (error) throw error;
}
