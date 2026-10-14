// Demo mode stand-in for the Supabase client: the same builder API the app
// uses (from/select/insert/update/upsert/delete/rpc, filters, single), plus
// auth, storage, and Realtime emulated by polling. Queries are passed to a
// transport: in the browser that's POST /api/demo/db, on the server it's
// the in-process database directly.

import { SESSION_COOKIE, readSessionFromCookieHeader, type DemoSession, type FilterOp, type QueryDesc, type QueryResult } from "./types";

type Transport = (desc: QueryDesc) => Promise<QueryResult>;

class Query implements PromiseLike<QueryResult> {
  constructor(
    private run: Transport,
    private desc: QueryDesc,
  ) {}

  private f(op: FilterOp, col: string, value: unknown) {
    this.desc.filters.push({ op, col, value });
    return this;
  }
  eq(col: string, v: unknown) { return this.f("eq", col, v); }
  neq(col: string, v: unknown) { return this.f("neq", col, v); }
  gt(col: string, v: unknown) { return this.f("gt", col, v); }
  gte(col: string, v: unknown) { return this.f("gte", col, v); }
  lt(col: string, v: unknown) { return this.f("lt", col, v); }
  lte(col: string, v: unknown) { return this.f("lte", col, v); }
  in(col: string, v: unknown[]) { return this.f("in", col, v); }
  is(col: string, v: null | boolean) { return this.f("is", col, v); }
  ilike(col: string, v: string) { return this.f("ilike", col, v); }

  select(cols = "*", opts?: { count?: "exact"; head?: boolean }) {
    this.desc.select = cols;
    if (opts?.count) this.desc.count = opts.count;
    if (opts?.head) this.desc.head = true;
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.desc.order.push({ col, ascending: opts?.ascending ?? true });
    return this;
  }
  limit(n: number) {
    this.desc.limit = n;
    return this;
  }
  single<T = unknown>() {
    this.desc.single = "single";
    return this as unknown as PromiseLike<{ data: T; error: QueryResult["error"] }>;
  }
  maybeSingle<T = unknown>() {
    this.desc.single = "maybeSingle";
    return this as unknown as PromiseLike<{ data: T | null; error: QueryResult["error"] }>;
  }
  then<A = QueryResult, B = never>(ok?: ((v: QueryResult) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return this.run(this.desc).then(ok, bad);
  }
}

const base = (kind: QueryDesc["kind"], table?: string): QueryDesc => ({ kind, table, select: null, filters: [], order: [] });

function table(run: Transport, name: string) {
  return {
    select: (cols = "*", opts?: { count?: "exact"; head?: boolean }) => new Query(run, { ...base("select", name) }).select(cols, opts),
    insert: (values: QueryDesc["values"]) => new Query(run, { ...base("insert", name), values }),
    update: (values: Record<string, unknown>) => new Query(run, { ...base("update", name), values }),
    upsert: (values: QueryDesc["values"], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) =>
      new Query(run, { ...base("upsert", name), values, onConflict: opts?.onConflict, ignoreDuplicates: opts?.ignoreDuplicates }),
    delete: () => new Query(run, base("delete", name)),
  };
}

// ---- Realtime, emulated by polling the table every 2s ----

interface Listener {
  event: string;
  table: string;
  filter?: string;
  cb: (payload: { new: Record<string, unknown> }) => void;
}

function channel(run: Transport) {
  const listeners: Listener[] = [];
  const presence: (() => void)[] = [];
  const timers: number[] = [];
  const ch = {
    on(type: string, opts: { event?: string; table?: string; filter?: string }, cb: (p: { new: Record<string, unknown> }) => void) {
      if (type === "postgres_changes") listeners.push({ event: opts.event ?? "*", table: opts.table!, filter: opts.filter, cb });
      if (type === "presence") presence.push(cb as unknown as () => void);
      return ch;
    },
    subscribe(cb?: (status: string) => void) {
      for (const l of listeners) timers.push(poll(run, l));
      setTimeout(() => {
        cb?.("SUBSCRIBED");
        presence.forEach((p) => p());
      }, 50);
      return ch;
    },
    async track() {
      return "ok";
    },
    presenceState() {
      return {};
    },
    unsubscribe() {
      timers.forEach((t) => clearInterval(t));
    },
  };
  return ch;
}

function poll(run: Transport, l: Listener): number {
  const desc = base("select", l.table);
  desc.select = "*";
  desc.limit = 200;
  if (l.filter) {
    const m = l.filter.match(/^(\w+)=eq\.(.+)$/);
    if (m) desc.filters.push({ op: "eq", col: m[1], value: m[2] });
  }
  const key = (r: Record<string, unknown>) => String(r.id ?? r.token ?? r.code ?? JSON.stringify(r));
  let seen: Map<string, string> | null = null;
  const tick = async () => {
    const { data } = await run(JSON.parse(JSON.stringify(desc)) as QueryDesc);
    const rows = (data as Record<string, unknown>[] | null) ?? [];
    const next = new Map(rows.map((r) => [key(r), JSON.stringify(r)]));
    if (seen) {
      for (const r of rows) {
        const prev = seen.get(key(r));
        const isInsert = prev === undefined;
        const isUpdate = prev !== undefined && prev !== next.get(key(r));
        if ((isInsert && (l.event === "INSERT" || l.event === "*")) || (isUpdate && (l.event === "UPDATE" || l.event === "*"))) {
          l.cb({ new: r });
        }
      }
    }
    seen = next;
  };
  void tick();
  return setInterval(() => void tick(), 2000) as unknown as number;
}

// ---- Auth ----

export function createFakeClient(
  run: Transport,
  opts: { user: () => DemoSession | null; verify?: (phone: string, token: string) => Promise<{ message: string } | null>; signOut?: () => Promise<void> },
) {
  const claims = () => {
    const u = opts.user();
    return u ? { claims: { sub: u.id, phone: u.phone, email: "" } } : null;
  };
  return {
    from: (name: string) => table(run, name),
    rpc: (fn: string, args?: Record<string, unknown>) => new Query(run, { ...base("rpc"), fn, args }),
    channel: () => channel(run),
    removeChannel: async (ch: { unsubscribe: () => void }) => {
      ch.unsubscribe();
      return "ok";
    },
    storage: {
      from: () => ({
        upload: async (path: string) => ({ data: { path }, error: null }),
      }),
    },
    auth: {
      getClaims: async () => ({ data: claims(), error: null }),
      getUser: async () => {
        const c = claims();
        return { data: { user: c ? { id: c.claims.sub, phone: c.claims.phone } : null }, error: null };
      },
      // No SMS in local mode: the code is the configured one-time code.
      signInWithOtp: async () => ({ data: {}, error: null }),
      verifyOtp: async (args: { phone?: string; token?: string }) => {
        const error = opts.verify ? await opts.verify(args.phone ?? "", args.token ?? "") : { message: "Not available" };
        return { data: {}, error };
      },
      signOut: async () => {
        await opts.signOut?.();
        return { error: null };
      },
    },
  };
}

/** Browser: queries go to /api/demo/db; sign-in goes to /api/demo/auth (sets the session cookie). */
export function createBrowserFakeClient() {
  const run: Transport = async (desc) => {
    try {
      const res = await fetch("/api/demo/db", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(desc) });
      return (await res.json()) as QueryResult;
    } catch (err) {
      return { data: null, error: { message: `TypeError: Failed to fetch (${(err as Error).message})` } };
    }
  };
  return createFakeClient(run, {
    user: () => readSessionFromCookieHeader(typeof document === "undefined" ? undefined : document.cookie),
    verify: async (phone, token) => {
      const res = await fetch("/api/demo/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, token }) });
      return res.ok ? null : { message: ((await res.json().catch(() => ({}))) as { message?: string }).message ?? "Token has expired or is invalid" };
    },
    signOut: async () => {
      await fetch("/api/demo/auth", { method: "DELETE" });
      document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
    },
  });
}
