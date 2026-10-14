// Row types mirror supabase/migrations exactly (snake_case), so data from
// Supabase needs no mapping. Money is always integer kobo (₦1 = 100 kobo).
// Once the project is linked, `npx supabase gen types` can replace these.

export type Kobo = number;
export type ISODateString = string;
export type UUID = string;

export type FormatId =
  // MVP
  | "finish-the-lyric"
  | "name-the-song"
  | "money-ladder"
  | "pick-a-box"
  | "spin-the-wheel"
  | "quickfire-trivia"
  // V2
  | "this-or-that"
  | "price-check"
  | "dare-timer"
  | "crowd-decides";

export interface Profile {
  id: UUID;
  display_name: string;
  created_at: ISODateString;
}

export interface Creator {
  id: UUID;
  display_name: string;
  /** Public handle, used in /play/[handle]. */
  instagram_handle: string | null;
  plan: "free" | "pro";
  kyc_status: "pending" | "verified" | "rejected";
  limit_per_round: Kobo;
  limit_per_episode: Kobo;
  limit_per_day: Kobo;
  /** Above this, the host holds SEND to confirm. */
  confirm_above: Kobo;
  allow_repeat_winners: boolean;
  phone: string | null;
  bvn_last4: string | null;
  bvn_name: string | null;
  return_bank_code: string | null;
  return_account_number: string | null;
  return_account_name: string | null;
  selfie_path: string | null;
  kyc_submitted_at: ISODateString | null;
  virtual_account_number: string | null;
  virtual_account_bank: string | null;
  virtual_account_name: string | null;
  default_episode_id: UUID | null;
  created_at: ISODateString;
}

/** Per-format slice of the episode budget, set on the Budget step. */
export interface FormatPlanEntry {
  amount: Kobo;
  rounds: number;
  /** Per-format prize settings; see lib/games/plan.ts. */
  unit: Kobo;
  top: Kobo;
}
export type FormatPlan = Partial<Record<FormatId, FormatPlanEntry>>;

/** What the viewer page shows between rounds. Set from Live control. */
export interface LiveState {
  round?: number;
  format?: FormatId;
  starts_at?: ISODateString;
  note?: string;
}

export interface Episode {
  id: UUID;
  creator_id: UUID;
  number: number;
  title: string;
  location: string | null;
  starts_at: ISODateString | null;
  status: "draft" | "live" | "wrapped";
  formats: FormatId[];
  pack_ids: string[];
  format_plan: FormatPlan;
  budget: Kobo;
  round_cap: Kobo;
  max_payout: Kobo | null;
  confirm_above: Kobo | null;
  repeat_policy: "allow" | "flag" | "block";
  live_code: string | null;
  public_code: string;
  live_state: LiveState;
  sponsor_name: string | null;
  wrapped_at: ISODateString | null;
  created_at: ISODateString;
}

export type RoundStatus = "setup" | "playing" | "won" | "lost" | "walked-away" | "void";

export interface Round {
  id: UUID;
  episode_id: UUID;
  number: number | null;
  format: FormatId;
  status: RoundStatus;
  prize_cap: Kobo;
  prize_won: Kobo;
  participant_name: string | null;
  /** sha256(seed), fixed before play. */
  commitment: string | null;
  seed: string | null;
  summary: string | null;
  result: Record<string, unknown>;
  started_at: ISODateString | null;
  ended_at: ISODateString | null;
  created_at: ISODateString;
}

export interface Consent {
  id: UUID;
  round_id: UUID;
  name_given: string;
  release_version: string;
  agreed_at: ISODateString;
}

export interface ClipMarker {
  id: UUID;
  episode_id: UUID;
  round_id: UUID | null;
  label: "funny" | "big-win" | "reaction" | (string & {});
  at: ISODateString;
}

export type PayoutStatus = "held" | "sending" | "sent" | "failed" | "reversed" | "expired";

export interface Payout {
  id: UUID;
  idempotency_key: string;
  creator_id: UUID;
  episode_id: UUID;
  round_id: UUID | null;
  kind: "participant" | "viewer";
  channel: "bank" | "airtime";
  amount: Kobo;
  fee: Kobo;
  account_number: string | null;
  bank_code: string | null;
  account_name: string | null;
  /** "Adaeze O." — what receipts show. */
  recipient_display: string | null;
  recipient_phone: string | null;
  status: PayoutStatus;
  repeat_winner: boolean;
  receipt_code: string;
  claim_code: string | null;
  claim_expires_at: ISODateString | null;
  account_request_token: string | null;
  fan_id: UUID | null;
  provider_reference: string | null;
  failure_reason: string | null;
  created_by: UUID;
  anonymized_at: ISODateString | null;
  created_at: ISODateString;
  sent_at: ISODateString | null;
}

/**
 * What the host app sends to POST /api/payouts. The server does its own name
 * enquiry. With `hold`, the payout waits for the winner to claim it by code
 * (bankless winners): send recipient_phone instead of account details.
 */
export interface PayoutDraft {
  idempotency_key: string;
  episode_id: UUID;
  round_id: UUID | null;
  amount: Kobo;
  account_number?: string;
  bank_code?: string;
  /** First name the participant gave on camera; used for "Adaeze O.". */
  participant_name?: string;
  recipient_phone?: string;
  account_request_token?: string;
  hold?: boolean;
}

export interface WalletEntry {
  id: UUID;
  creator_id: UUID;
  kind: "topup" | "sponsor" | "payout" | "fee" | "refund" | "withdrawal" | "adjustment";
  amount: Kobo;
  reference: string;
  payout_id: UUID | null;
  episode_id: UUID | null;
  counterparty: string | null;
  note: string | null;
  created_at: ISODateString;
}

export interface WalletSummary {
  balance: Kobo;
  /** Budget still promised to unwrapped episodes. */
  assigned: Kobo;
  free: Kobo;
}

export interface Withdrawal {
  id: UUID;
  creator_id: UUID;
  amount: Kobo;
  fee: Kobo;
  status: "sending" | "sent" | "failed";
  account_number: string;
  bank_code: string;
  account_name: string;
  episode_id: UUID | null;
  created_at: ISODateString;
  sent_at: ISODateString | null;
}

export interface AccountRequest {
  token: string;
  /** Short code in the QR link: /p/[code]. */
  code: string;
  episode_id: UUID;
  round_id: UUID | null;
  amount: Kobo | null;
  participant_name: string | null;
  account_number: string | null;
  bank_code: string | null;
  account_name: string | null;
  status: "waiting" | "named" | "confirmed" | "paid" | "cancelled";
  phone: string | null;
  payout_id: UUID | null;
  submitted_at: ISODateString | null;
  expires_at: ISODateString;
  created_at: ISODateString;
}

/** Public receipt: first name + initial, never an account number. */
export interface PublicReceipt {
  receipt_code: string;
  amount: Kobo;
  /** Null when the winner asked for their data to be deleted. */
  recipient_display: string | null;
  status: "sending" | "sent" | "reversed";
  channel: "bank" | "airtime";
  kind: "participant" | "viewer";
  created_at: ISODateString;
  sent_at: ISODateString | null;
  provider_confirmed: boolean;
  account_last2: string | null;
  bank_code: string | null;
  phone_last4: string | null;
  anonymized: boolean;
  episode_title: string;
  episode_number: number;
  episode_code: string;
  sponsor_name: string | null;
  creator_name: string;
  creator_handle: string | null;
  round_id: UUID | null;
  round_number: number | null;
  round_format: FormatId | null;
  commitment: string | null;
  seed_sealed_at: ISODateString | null;
  consent_at: ISODateString | null;
}

export interface PublicEpisode {
  episode_id: UUID;
  title: string;
  number: number;
  location: string | null;
  starts_at: ISODateString | null;
  status: Episode["status"];
  wrapped_at: ISODateString | null;
  creator_name: string;
  creator_handle: string | null;
  sponsor_name: string | null;
  paid_total: Kobo;
  paid_count: number;
  confirmed_count: number;
  rounds_count: number;
  seeds_revealed: number;
  left_over: Kobo;
}

export interface PublicEpisodePayout {
  created_at: ISODateString;
  recipient_display: string | null;
  round_number: number | null;
  round_format: FormatId | null;
  amount: Kobo;
  receipt_code: string;
  status: "sending" | "sent" | "reversed";
}

export interface PublicRound {
  id: UUID;
  number: number | null;
  format: FormatId;
  status: RoundStatus;
  commitment: string | null;
  /** Null until the round has ended. */
  seed: string | null;
  result: Record<string, unknown>;
  started_at: ISODateString | null;
  ended_at: ISODateString | null;
  episode_title: string;
  episode_number: number;
  creator_name: string;
  creator_handle: string | null;
}

// ---- Live mode ----

export interface LiveSession {
  creator_id: UUID;
  creator_name: string;
  handle: string;
  /** Null when the creator has never gone live. */
  episode_id: UUID | null;
  episode_number: number | null;
  title: string | null;
  location: string | null;
  status: Episode["status"] | null;
  sponsor_name: string | null;
  live_state: LiveState | null;
  players: number;
  wrapped_at: ISODateString | null;
}

export type PromptKind = "vote" | "predict" | "quiz" | "text";

export interface LivePrompt {
  id: UUID;
  episode_id: UUID;
  round_id: UUID | null;
  kind: PromptKind;
  question: string;
  options: string[];
  label: string | null;
  round_number: number | null;
  status: "open" | "closed" | "resolved";
  correct_option: number | null;
  reveal_note: string | null;
  duration_seconds: number | null;
  opened_at: ISODateString;
  closes_at: ISODateString | null;
  resolved_at: ISODateString | null;
}

export interface PromptStats {
  answered: number;
  correct: number;
  /** Responses per option index (0–5). */
  options: number[];
}

export interface LeaderboardRow {
  rank: number;
  display_name: string;
  points: number;
  best_streak: number;
}

export type LeaderboardPeriod = "live" | "month" | "all";

/** The signed-in fan, from GET /api/live/[handle]/me. */
export interface FanStanding {
  id: UUID;
  display_name: string;
  points: number;
  rank: number;
  streak: number;
  correct: number;
  answered: number;
  /** Code for an unclaimed prize in this episode, if they won one. */
  prize: { code: string; amount: Kobo; expires_at: ISODateString } | null;
}

export interface RespondResult {
  points: number;
  correct: boolean | null;
  /** Milliseconds from the prompt opening to this answer. */
  elapsed_ms: number;
  total: number;
}

// ---- Content (static packs in src/content) ----

export interface Question {
  id: string;
  prompt: string;
  answer: string;
  choices?: string[];
  difficulty: 1 | 2 | 3;
}

/** No lyrics or audio: title, artist, cue time, difficulty. See spec § Music rounds. */
export interface SongCard {
  id: string;
  title: string;
  artist: string;
  cueSeconds: number;
  difficulty: 1 | 2 | 3;
  artistSponsored?: boolean;
}

export interface QuestionPack {
  id: string;
  title: string;
  kind: "questions";
  premium: boolean;
  items: Question[];
}

export interface SongPack {
  id: string;
  title: string;
  kind: "songs";
  premium: boolean;
  items: SongCard[];
}

export type ContentPack = QuestionPack | SongPack;
