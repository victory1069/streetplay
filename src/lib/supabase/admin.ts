import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";
import { demoRoleClient } from "@/lib/demo/server";
import { isDemo } from "@/lib/demo/types";

// Service-role client: bypasses RLS. Only for route handlers that move money
// or write on behalf of anonymous viewers/participants. Never import from a
// client component.
export function createAdminClient() {
  if (isDemo()) return demoRoleClient("service") as unknown as ReturnType<typeof realAdminClient>;
  return realAdminClient();
}

function realAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set.");
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
