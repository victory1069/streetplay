"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getStudioContext, type StudioContext } from "@/lib/data/studio";

// Who's signed in and which creator they work for, loaded once for every
// /studio screen. Signed-in users with no studio are sent to onboarding.
// Works offline from the cached copy.

interface Value {
  ctx: StudioContext | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<Value>({ ctx: null, loading: true, refresh: async () => {} });

const OPEN_PATHS = ["/studio/welcome"];

export function StudioProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<StudioContext | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      setCtx(await getStudioContext());
    } catch {
      /* offline with nothing cached: leave as is */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    getStudioContext()
      .then((c) => {
        if (!alive) return;
        setCtx(c);
        setLoading(false);
        if (!c && !OPEN_PATHS.includes(pathname)) router.replace("/studio/welcome");
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // Load once per mount; pages call refresh() after changing it.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <Ctx.Provider value={{ ctx, loading, refresh }}>{children}</Ctx.Provider>;
}

/** Full context (may be null while loading or during onboarding). */
export function useStudioState(): Value {
  return useContext(Ctx);
}

/** The signed-in host's context, or null while it loads. */
export function useStudio(): StudioContext | null {
  return useContext(Ctx).ctx;
}
