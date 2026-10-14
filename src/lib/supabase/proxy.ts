import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "./env";

// Refreshes the auth session on every matched request and writes the new
// cookies to the response. Redirects signed-out users away from /studio.
export async function updateSession(request: NextRequest) {
  // Local mode: no Supabase session to refresh; the session is a cookie set
  // by /api/demo/auth after the one-time code.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "1") {
    if (!request.cookies.get("sp_session")?.value && request.nextUrl.pathname.startsWith("/studio")) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Must run before anything else touches the response.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && request.nextUrl.pathname.startsWith("/studio")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
