import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { maskAccount, maskPhone } from "@/lib/format";
import type { AccountRequest, FormatId, Kobo, Payout } from "@/types/domain";

// Read models for pages that strangers open without signing in. Built with
// the service-role client, so they expose only what each page needs.

export interface ParticipantView {
  code: string;
  participant_name: string | null;
  amount: Kobo | null;
  status: AccountRequest["status"];
  expired: boolean;
  /** Shown only after the participant entered their own account. */
  account_name: string | null;
  bank_code: string | null;
  account_masked: string | null;
  creator_name: string;
  creator_handle: string | null;
  episode_number: number;
  round_number: number | null;
  round_format: FormatId | null;
  payout: { status: Payout["status"]; receipt_code: string; sent_at: string | null; phone_masked: string | null } | null;
}

export async function participantView(admin: SupabaseClient, code: string): Promise<ParticipantView | null> {
  const { data } = await admin
    .from("account_requests")
    .select(
      "*, episode:episodes(number, creator:creators(display_name, instagram_handle)), round:rounds(number, format), payout:payouts!account_requests_payout_fk(status, receipt_code, sent_at, recipient_phone)",
    )
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (!data) return null;

  const r = data as AccountRequest & {
    episode: { number: number; creator: { display_name: string; instagram_handle: string | null } };
    round: { number: number | null; format: FormatId } | null;
    payout: { status: Payout["status"]; receipt_code: string; sent_at: string | null; recipient_phone: string | null } | null;
  };
  const named = r.status !== "waiting";
  return {
    code: r.code,
    participant_name: r.participant_name,
    amount: r.amount,
    status: r.status,
    expired: r.status === "waiting" && new Date(r.expires_at) < new Date(),
    account_name: named ? r.account_name : null,
    bank_code: named ? r.bank_code : null,
    account_masked: named ? maskAccount(r.account_number) : null,
    creator_name: r.episode.creator.display_name,
    creator_handle: r.episode.creator.instagram_handle,
    episode_number: r.episode.number,
    round_number: r.round?.number ?? null,
    round_format: r.round?.format ?? null,
    payout: r.payout
      ? {
          status: r.payout.status,
          receipt_code: r.payout.receipt_code,
          sent_at: r.payout.sent_at,
          phone_masked: r.payout.recipient_phone ? maskPhone(r.payout.recipient_phone) : (r.phone ? maskPhone(r.phone) : null),
        }
      : null,
  };
}

export interface ClaimView {
  code: string;
  amount: Kobo;
  status: Payout["status"];
  kind: Payout["kind"];
  expires_at: string | null;
  recipient_display: string | null;
  phone_masked: string | null;
  receipt_code: string;
  creator_name: string;
  creator_handle: string | null;
  episode_number: number;
  round_format: FormatId | null;
  /** Leaderboard rank for viewer prizes. */
  airtime_available: boolean;
}

export async function claimView(admin: SupabaseClient, code: string, airtimeAvailable: boolean): Promise<ClaimView | null> {
  await admin.rpc("release_expired_claims");
  const { data } = await admin
    .from("payouts")
    .select("*, episode:episodes(number, creator:creators(display_name, instagram_handle)), round:rounds(format)")
    .eq("claim_code", code.toUpperCase())
    .maybeSingle();
  if (!data) return null;
  const p = data as Payout & {
    episode: { number: number; creator: { display_name: string; instagram_handle: string | null } };
    round: { format: FormatId } | null;
  };
  return {
    code: p.claim_code!,
    amount: p.amount,
    status: p.status,
    kind: p.kind,
    expires_at: p.claim_expires_at,
    recipient_display: p.recipient_display,
    phone_masked: p.recipient_phone ? maskPhone(p.recipient_phone) : null,
    receipt_code: p.receipt_code,
    creator_name: p.episode.creator.display_name,
    creator_handle: p.episode.creator.instagram_handle,
    episode_number: p.episode.number,
    round_format: p.round?.format ?? null,
    airtime_available: airtimeAvailable && p.kind === "viewer",
  };
}
