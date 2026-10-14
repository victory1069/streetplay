import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./env";
import { createBrowserFakeClient } from "@/lib/demo/fake-client";
import { isDemo } from "@/lib/demo/types";

const real = () => createBrowserClient(supabaseUrl(), supabasePublishableKey());
type BrowserClient = ReturnType<typeof real>;
let demo: BrowserClient | null = null;

// Browser client (host app, viewer page). Same instance on every call.
// Demo mode (NEXT_PUBLIC_DEMO_MODE=1) swaps in the in-memory demo database.
export function createClient() {
  if (isDemo()) return (demo ??= createBrowserFakeClient() as unknown as BrowserClient);
  return real();
}
