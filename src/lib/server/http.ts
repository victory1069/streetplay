import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Small helpers every route handler uses: JSON errors with a human message
// the screens can show as-is, client IP, and a database-backed rate limit.

export function fail(status: number, error: string, message: string): Response {
  return Response.json({ error, message }, { status });
}

export const badRequest = (message: string) => fail(400, "bad_request", message);
export const unauthorized = () => fail(401, "unauthorized", "Sign in first.");
export const tooMany = () => fail(429, "rate_limited", "Too many tries. Wait a minute and try again.");

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/** True when allowed. Fails open if the database is unreachable. */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed", error.message);
    return true;
  }
  return data === true;
}

export async function readJson<T>(request: Request): Promise<Partial<T>> {
  return ((await request.json().catch(() => null)) ?? {}) as Partial<T>;
}

// Errors raised by the SQL functions, mapped to messages for the screens.
const DB_ERRORS: Record<string, { status: number; message: string }> = {
  not_owner: { status: 403, message: "That isn't your show." },
  episode_not_found: { status: 404, message: "Episode not found." },
  round_not_in_episode: { status: 400, message: "That round isn't part of this episode." },
  payout_not_found: { status: 404, message: "Payout not found." },
  receipt_not_found: { status: 404, message: "Receipt not found." },
  kyc_not_verified: { status: 403, message: "Finish opening your wallet before paying out." },
  episode_wrapped: { status: 409, message: "This episode is wrapped." },
  payout_limit: { status: 409, message: "That's over the max per payout for this episode." },
  round_limit: { status: 409, message: "That's over this round's prize cap." },
  episode_limit: { status: 409, message: "That's over the episode budget." },
  day_limit: { status: 409, message: "That's over today's payout limit." },
  repeat_winner: { status: 409, message: "This account has already won on your show." },
  insufficient_balance: { status: 402, message: "Not enough in the wallet. Fund it first." },
  bad_claim_code: { status: 404, message: "That code doesn't match any prize." },
  already_claimed: { status: 409, message: "This prize has already been claimed." },
  claim_expired: { status: 410, message: "This claim code has expired. The money went back to the host." },
  no_return_account: { status: 409, message: "Add a return account first." },
  bad_amount: { status: 400, message: "Enter an amount." },
};

export function dbError(error: { message: string }): Response {
  if (error.message.includes("payouts_one_per_round")) {
    return fail(409, "round_already_paid", "This round's winner has already been paid.");
  }
  const known = DB_ERRORS[error.message];
  if (known) return fail(known.status, error.message, known.message);
  console.error(error);
  return fail(500, "server_error", "Something went wrong. Try again.");
}
