import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "./env";
import { demoRoleClient } from "@/lib/demo/server";
import { isDemo } from "@/lib/demo/types";

// Cookie-less anonymous client for public pages (receipts, verify, viewer
// lookups). Reads only what the anon role is allowed through RLS/functions.
export function createPublicClient() {
  if (isDemo()) return demoRoleClient("anon") as unknown as ReturnType<typeof realPublicClient>;
  return realPublicClient();
}

function realPublicClient() {
  return createClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
