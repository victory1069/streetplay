import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { runQuery } from "./db";
import { createFakeClient } from "./fake-client";
import { SESSION_COOKIE, parseSession, type DemoRole } from "./types";

// Server-side demo clients, standing in for the three Supabase factories.
// connection() marks each read as request-time data, as a real network call
// to Supabase would be, so Cache Components doesn't try to prerender it.
const live = async <T>(fn: () => Promise<T>) => {
  await connection();
  return fn();
};

export async function demoUserClient() {
  const store = await cookies();
  const user = parseSession(store.get(SESSION_COOKIE)?.value);
  return createFakeClient((d) => live(() => runQuery(d, user ? "authenticated" : "anon", user?.id ?? null)), { user: () => user });
}

export function demoRoleClient(role: Exclude<DemoRole, "authenticated">) {
  return createFakeClient((d) => live(() => runQuery(d, role, null)), { user: () => null });
}
