import "server-only";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import type { DemoRole, QueryDesc, QueryResult } from "./types";

// Local mode database: real Postgres (PGlite, in-process WASM) running the
// real migrations plus the demo seed, behind a tiny PostgREST-style
// translator. Money rules, RLS and scoring behave exactly as on Supabase.
// Data is saved in .demo-data/ (git-ignored); `npm run demo:reset` wipes it
// and the next start re-seeds.

interface Fk {
  name: string;
  table: string;
  col: string;
  refTable: string;
  refCol: string;
}
interface Meta {
  fks: Fk[];
  /** table → column → udt name (e.g. "jsonb", "_text", "uuid") */
  cols: Map<string, Map<string, string>>;
  /** function → how PostgREST would shape its result */
  fns: Map<string, "set" | "composite" | "scalar">;
}

interface DemoDb {
  db: PGlite;
  meta: Meta;
}

const g = globalThis as unknown as { __spDemoDb?: Promise<DemoDb> };

export function demoDb(): Promise<DemoDb> {
  g.__spDemoDb ??= init();
  return g.__spDemoDb;
}

async function init(): Promise<DemoDb> {
  const root = process.cwd();
  const db = new PGlite(path.join(root, ".demo-data"), { extensions: { pgcrypto } });
  const fresh = !(await db.query<{ t: string | null }>(`select to_regclass('public.creators')::text as t`)).rows[0]?.t;

  if (fresh) {
    await db.exec(`
      create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key default gen_random_uuid(), email text, phone text unique, created_at timestamptz default now());
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create schema extensions;
      grant usage on schema public, extensions, auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      create publication supabase_realtime;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
      alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    `);
    const migrationsDir = path.join(root, "supabase", "migrations");
    for (const file of (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort()) {
      await db.exec(await readFile(path.join(migrationsDir, file), "utf8"));
    }
    await db.exec(`grant execute on all functions in schema extensions to anon, authenticated, service_role;`);
    await db.exec(await readFile(path.join(root, "supabase", "seed", "demo.sql"), "utf8"));
    console.info("[local] database created and seeded in .demo-data/");
  }
  await db.exec(`set timezone = 'UTC'`);

  return { db, meta: await loadMeta(db) };
}

/** Sign-in: the account for this phone number, created on first sign-in. */
export async function findOrCreateUser(phone: string): Promise<string> {
  const { db } = await demoDb();
  const found = await db.query<{ id: string }>(`select id from auth.users where phone = $1`, [phone]);
  if (found.rows[0]) return found.rows[0].id;
  const created = await db.query<{ id: string }>(`insert into auth.users (phone) values ($1) returning id`, [phone]);
  return created.rows[0].id;
}

async function loadMeta(db: PGlite): Promise<Meta> {
  const fks = (
    await db.query<Fk>(`
      select c.conname as name, rel.relname as "table", a.attname as col, frel.relname as "refTable", fa.attname as "refCol"
      from pg_constraint c
      join pg_class rel on rel.oid = c.conrelid
      join pg_namespace n on n.oid = rel.relnamespace and n.nspname = 'public'
      join pg_class frel on frel.oid = c.confrelid
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      join pg_attribute fa on fa.attrelid = c.confrelid and fa.attnum = c.confkey[1]
      where c.contype = 'f' and array_length(c.conkey, 1) = 1
    `)
  ).rows;

  const cols = new Map<string, Map<string, string>>();
  for (const r of (
    await db.query<{ table_name: string; column_name: string; udt_name: string }>(
      `select table_name, column_name, udt_name from information_schema.columns where table_schema = 'public'`,
    )
  ).rows) {
    if (!cols.has(r.table_name)) cols.set(r.table_name, new Map());
    cols.get(r.table_name)!.set(r.column_name, r.udt_name);
  }

  const fns = new Map<string, "set" | "composite" | "scalar">();
  for (const r of (
    await db.query<{ proname: string; proretset: boolean; typtype: string }>(`
      select p.proname, p.proretset, t.typtype
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
      join pg_type t on t.oid = p.prorettype
    `)
  ).rows) {
    fns.set(r.proname, r.proretset ? "set" : r.typtype === "c" ? "composite" : "scalar");
  }
  return { fks, cols, fns };
}

// ---------------------------------------------------------------------------

const ident = (s: string) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw new Error(`bad identifier: ${s}`);
  return `"${s}"`;
};

class Params {
  values: unknown[] = [];
  add(v: unknown, udt?: string): string {
    if (udt === "json" || udt === "jsonb" || (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date))) {
      this.values.push(v === null || v === undefined ? null : JSON.stringify(v));
      return `$${this.values.length}::jsonb`;
    }
    this.values.push(v === undefined ? null : v);
    return `$${this.values.length}`;
  }
}

interface SelectItem {
  kind: "star" | "col" | "embed";
  name: string;
  table?: string;
  hint?: string;
  cols?: string;
}

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

function parseSelect(s: string): SelectItem[] {
  return splitTop(s.replace(/\s+/g, " ")).map((item) => {
    if (item === "*") return { kind: "star", name: "*" };
    const m = item.match(/^(?:(\w+)\s*:\s*)?(\w+)(?:!(\w+))?\s*\(([\s\S]*)\)$/);
    if (m) return { kind: "embed", name: m[1] ?? m[2], table: m[2], hint: m[3], cols: m[4] };
    const c = item.match(/^(?:(\w+)\s*:\s*)?(\w+)$/);
    if (!c) throw new Error(`unsupported select item: ${item}`);
    return { kind: "col", name: c[1] ?? c[2], table: c[2] };
  });
}

class Sql {
  private n = 0;
  constructor(private meta: Meta) {}
  alias() {
    return `t${++this.n}`;
  }

  /** Select list for `table` aliased `alias`; returns [list, innerConditions]. */
  list(table: string, alias: string, select: string): [string, string[]] {
    const inner: string[] = [];
    const parts = parseSelect(select).map((it) => {
      if (it.kind === "star") return `${alias}.*`;
      if (it.kind === "col") return `${alias}.${ident(it.table!)} as ${ident(it.name)}`;
      const sub = this.embed(table, alias, it);
      if (it.hint === "inner") inner.push(`(${sub}) is not null`);
      return `(${sub}) as ${ident(it.name)}`;
    });
    return [parts.join(", "), inner];
  }

  embed(parent: string, parentAlias: string, it: SelectItem): string {
    const hint = it.hint && it.hint !== "inner" ? it.hint : undefined;
    const child = it.table!;
    const a = this.alias();
    const m2o = this.meta.fks.filter((f) => f.table === parent && f.refTable === child && (!hint || f.name === hint));
    if (m2o.length) {
      const fk = m2o[0];
      const [list] = this.list(child, a, it.cols!);
      return `select row_to_json(x) from (select ${list} from public.${ident(child)} ${a} where ${a}.${ident(fk.refCol)} = ${parentAlias}.${ident(fk.col)}) x`;
    }
    const o2m = this.meta.fks.filter((f) => f.table === child && f.refTable === parent && (!hint || f.name === hint));
    if (o2m.length) {
      const fk = o2m[0];
      const [list] = this.list(child, a, it.cols!);
      return `select coalesce(json_agg(row_to_json(x)), '[]'::json) from (select ${list} from public.${ident(child)} ${a} where ${a}.${ident(fk.col)} = ${parentAlias}.${ident(fk.refCol)}) x`;
    }
    throw new Error(`no relationship between ${parent} and ${child}`);
  }

  where(table: string, alias: string, desc: QueryDesc, p: Params, extra: string[] = []): string {
    const types = this.meta.cols.get(table);
    const conds = desc.filters.map((f) => {
      const col = `${alias}.${ident(f.col)}`;
      const udt = types?.get(f.col);
      switch (f.op) {
        case "eq":
          return `${col} = ${p.add(f.value, udt === "jsonb" ? undefined : udt)}`;
        case "neq":
          return `${col} <> ${p.add(f.value)}`;
        case "gt":
          return `${col} > ${p.add(f.value)}`;
        case "gte":
          return `${col} >= ${p.add(f.value)}`;
        case "lt":
          return `${col} < ${p.add(f.value)}`;
        case "lte":
          return `${col} <= ${p.add(f.value)}`;
        case "ilike":
          return `${col} ilike ${p.add(f.value)}`;
        case "in":
          return `${col} = any(${p.add(f.value)})`;
        case "is":
          return f.value === null ? `${col} is null` : `${col} is ${f.value ? "true" : "false"}`;
      }
    });
    const all = [...conds, ...extra];
    return all.length ? ` where ${all.join(" and ")}` : "";
  }

  tail(alias: string, desc: QueryDesc): string {
    const order = desc.order.length
      ? ` order by ${desc.order.map((o) => `${alias}.${ident(o.col)} ${o.ascending ? "asc" : "desc"}`).join(", ")}`
      : "";
    return `${order}${desc.limit ? ` limit ${Math.floor(desc.limit)}` : ""}`;
  }
}

function isoDates(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(isoDates);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, isoDates(x)]));
  return v;
}

function shapeSingle(rows: unknown[], desc: QueryDesc): QueryResult {
  if (!desc.single) return { data: rows, error: null };
  if (rows.length === 1) return { data: rows[0], error: null };
  if (rows.length === 0 && desc.single === "maybeSingle") return { data: null, error: null };
  return {
    data: null,
    error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" },
  };
}

/** Runs one query as `role` (and `userId` for authenticated), inside a transaction. */
export async function runQuery(desc: QueryDesc, role: DemoRole, userId: string | null): Promise<QueryResult> {
  const { db, meta } = await demoDb();
  const sql = new Sql(meta);
  const p = new Params();
  let text: string;
  let returning = desc.select;

  try {
    if (desc.kind === "rpc") {
      const args = Object.entries(desc.args ?? {}).map(([k, v]) => `${ident(k)} => ${p.add(v)}`);
      text = `select * from public.${ident(desc.fn!)}(${args.join(", ")})`;
    } else {
      const table = desc.table!;
      const types = meta.cols.get(table);
      if (!types) throw new Error(`relation "public.${table}" does not exist`);

      if (desc.kind === "select") {
        const a = sql.alias();
        if (desc.head) {
          text = `select count(*)::int as count from public.${ident(table)} ${a}${sql.where(table, a, desc, p)}`;
        } else {
          const [list, inner] = sql.list(table, a, desc.select ?? "*");
          text = `select ${list} from public.${ident(table)} ${a}${sql.where(table, a, desc, p, inner)}${sql.tail(a, desc)}`;
        }
        returning = null;
      } else {
        let core: string;
        if (desc.kind === "insert" || desc.kind === "upsert") {
          const rows = Array.isArray(desc.values) ? desc.values : [desc.values ?? {}];
          const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
          const values = rows
            .map((r) => `(${keys.map((k) => (k in r ? p.add(r[k], types.get(k)) : "default")).join(", ")})`)
            .join(", ");
          core = `insert into public.${ident(table)} (${keys.map(ident).join(", ")}) values ${values}`;
          if (desc.kind === "upsert") {
            const target = (desc.onConflict ?? "id").split(",").map((c) => ident(c.trim()));
            const updatable = keys.filter((k) => !target.includes(ident(k)));
            core +=
              desc.ignoreDuplicates || !updatable.length
                ? ` on conflict (${target.join(", ")}) do nothing`
                : ` on conflict (${target.join(", ")}) do update set ${updatable.map((k) => `${ident(k)} = excluded.${ident(k)}`).join(", ")}`;
          }
          core += " returning *";
        } else if (desc.kind === "update") {
          const a = sql.alias();
          const sets = Object.entries(desc.values ?? {}).map(([k, v]) => `${ident(k)} = ${p.add(v, types.get(k))}`);
          core = `update public.${ident(table)} ${a} set ${sets.join(", ")}${sql.where(table, a, desc, p)} returning ${a}.*`;
        } else {
          const a = sql.alias();
          core = `delete from public.${ident(table)} ${a}${sql.where(table, a, desc, p)} returning ${a}.*`;
        }
        if (returning === null) {
          // Like supabase-js without .select(): no RETURNING, so a row the
          // caller can't read back (RLS) is still written.
          text = core.replace(/ returning (\w+\.)?\*$/, "");
        } else {
          const a = sql.alias();
          const [list] = sql.list(table, a, returning);
          text = `with r as (${core}) select ${list} from r ${a}`;
        }
      }
    }

    const rows = await db.transaction(async (tx) => {
      const pgRole = role === "service" ? "service_role" : role;
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [role === "authenticated" ? (userId ?? "") : ""]);
      await tx.exec(`set local role ${pgRole}`);
      return (await tx.query<Record<string, unknown>>(text, p.values)).rows;
    });
    const data = isoDates(rows) as Record<string, unknown>[];

    if (desc.kind === "rpc") {
      const shape = meta.fns.get(desc.fn!) ?? "set";
      if (shape === "set") return { data, error: null };
      if (shape === "composite") return { data: data[0] ?? null, error: null };
      const first = data[0];
      return { data: first ? Object.values(first)[0] ?? null : null, error: null };
    }
    if (desc.kind === "select" && desc.head) return { data: null, error: null, count: Number(data[0]?.count ?? 0) };
    if (desc.kind !== "select" && desc.select === null) return { data: null, error: null };
    return { ...shapeSingle(data, desc), count: desc.count ? data.length : undefined };
  } catch (err) {
    const e = err as { message?: string; code?: string; detail?: string };
    return { data: null, error: { message: e.message ?? String(err), code: e.code, details: e.detail } };
  }
}
