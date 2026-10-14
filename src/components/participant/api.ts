"use client";

import { useEffect, useState } from "react";

// Tiny fetch helpers for the no-login pages (/p, /claim, /win). These pages
// skip the Supabase client entirely so they stay small on 3G.

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError("Network dey shaky. Check your signal and try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.message ?? "Something went wrong. Try again.", res.status);
  return data as T;
}

export interface Bank {
  code: string;
  name: string;
}

let bankCache: Bank[] | null = null;

/** Bank list from /api/banks, fetched once per page load. */
export function useBanks(): Bank[] | null {
  const [banks, setBanks] = useState<Bank[] | null>(bankCache);
  useEffect(() => {
    if (bankCache) return;
    let alive = true;
    api<Bank[]>("/api/banks")
      .then((b) => {
        bankCache = b;
        if (alive) setBanks(b);
      })
      .catch(() => {
        if (alive) setBanks([]);
      });
    return () => {
      alive = false;
    };
  }, []);
  return banks;
}

export const bankName = (banks: Bank[] | null, code: string | null | undefined) => banks?.find((b) => b.code === code)?.name ?? "Bank";
