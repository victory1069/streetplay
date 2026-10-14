"use client";

import { useEffect, useState } from "react";

// Small client hooks for the viewer pages.

export { useCountdown } from "@/components/ui/interactive";

/** Current time, refreshed every `ms`. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

/** localStorage that never throws (private mode, blocked storage). */
export const store = {
  get<T>(key: string): T | null {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  },
};

export const firstName = (s: string | null | undefined) => (s ?? "").trim().split(/\s+/)[0] || "The host";
