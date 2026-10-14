import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

// Viewers don't sign up. Joining sets an httpOnly cookie holding a random
// token; we store only its hash. One fan per creator, so points add up across
// that creator's Lives ("This month" board).

const cookieName = (handle: string) => `spf_${handle.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function issueFanToken(handle: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  (await cookies()).set(cookieName(handle), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return token;
}

export async function readFanTokenHash(handle: string): Promise<string | null> {
  const token = (await cookies()).get(cookieName(handle))?.value;
  return token ? hashToken(token) : null;
}

export interface FanContext {
  fan: { id: string; display_name: string; creator_id: string };
  session: {
    creator_id: string;
    handle: string;
    episode_id: string | null;
    status: string | null;
  };
}

/** The fan behind this request's cookie, plus the creator's current episode. */
export async function currentFan(admin: SupabaseClient, handle: string): Promise<FanContext | null> {
  const tokenHash = await readFanTokenHash(handle);
  if (!tokenHash) return null;
  const { data: rows } = await admin.rpc("live_session", { p_handle: handle });
  const session = (rows as FanContext["session"][] | null)?.[0];
  if (!session) return null;
  const { data: fan } = await admin
    .from("fans")
    .select("id, display_name, creator_id")
    .eq("token_hash", tokenHash)
    .eq("creator_id", session.creator_id)
    .maybeSingle();
  return fan ? { fan, session } : null;
}
