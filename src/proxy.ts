import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Only the studio and its API need a session. Viewer, participant and
// receipt pages skip the proxy so they stay fast on 3G.
export const config = {
  matcher: [
    "/studio/:path*",
    "/api/payouts/:path*",
    "/api/wallet/:path*",
    "/api/kyc/:path*",
    "/api/episodes/:path*",
    "/api/live/prizes",
  ],
};
