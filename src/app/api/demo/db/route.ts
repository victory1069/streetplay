import { cookies } from "next/headers";
import { runQuery } from "@/lib/demo/db";
import { SESSION_COOKIE, isDemo, parseSession, type QueryDesc } from "@/lib/demo/types";

// Local mode only: the browser's stand-in for Supabase's REST API. Runs as
// the signed-in user (session cookie) under the same RLS as production.
export async function POST(request: Request) {
  if (!isDemo()) return new Response("Not found", { status: 404 });
  const desc = (await request.json()) as QueryDesc;
  const user = parseSession((await cookies()).get(SESSION_COOKIE)?.value);
  return Response.json(await runQuery(desc, user ? "authenticated" : "anon", user?.id ?? null));
}
