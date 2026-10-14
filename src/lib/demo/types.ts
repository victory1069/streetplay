// Local mode (NEXT_PUBLIC_DEMO_MODE=1): the app runs against a local
// Postgres (PGlite) instead of Supabase. These are the shared wire types.

export type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "is" | "ilike";

export interface QueryDesc {
  kind: "select" | "insert" | "update" | "upsert" | "delete" | "rpc";
  table?: string;
  fn?: string;
  args?: Record<string, unknown>;
  /** Select list (PostgREST syntax, embeds included). Null on a mutation = no returning. */
  select: string | null;
  count?: "exact";
  head?: boolean;
  filters: { op: FilterOp; col: string; value: unknown }[];
  order: { col: string; ascending: boolean }[];
  limit?: number;
  single?: "single" | "maybeSingle";
  values?: Record<string, unknown> | Record<string, unknown>[];
  onConflict?: string;
  ignoreDuplicates?: boolean;
}

export interface QueryResult {
  data: unknown;
  error: { message: string; code?: string; details?: string } | null;
  count?: number | null;
}

export type DemoRole = "anon" | "authenticated" | "service";

/** Session cookie: "<user id>~<phone>". Set by /api/demo/auth after the OTP check. */
export const SESSION_COOKIE = "sp_session";

export interface DemoSession {
  id: string;
  phone: string;
}

export function parseSession(value: string | null | undefined): DemoSession | null {
  const m = value?.match(/^([0-9a-f-]{36})~(\d{10,15})$/);
  return m ? { id: m[1], phone: m[2] } : null;
}

export function readSessionFromCookieHeader(header: string | undefined): DemoSession | null {
  const m = header?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return parseSession(m ? decodeURIComponent(m[1]) : null);
}

export const isDemo = () => process.env.NEXT_PUBLIC_DEMO_MODE === "1";
