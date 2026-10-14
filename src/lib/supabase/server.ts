import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublishableKey, supabaseUrl } from "./env";
import { demoUserClient } from "@/lib/demo/server";
import { isDemo } from "@/lib/demo/types";

// Per-request client for Server Components and Route Handlers, acting as the
// signed-in user (RLS applies). Never share one across requests.
export async function createClient() {
  if (isDemo()) return (await demoUserClient()) as unknown as Awaited<ReturnType<typeof realClient>>;
  return realClient();
}

async function realClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

/** Signed-in user, verified from the JWT, or null. */
export async function getUser(): Promise<{ id: string; email: string | null; phone: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return null;
  return {
    id: data.claims.sub,
    email: (data.claims.email as string | undefined) || null,
    phone: (data.claims.phone as string | undefined) || null,
  };
}

export async function getUserId(): Promise<string | null> {
  return (await getUser())?.id ?? null;
}
