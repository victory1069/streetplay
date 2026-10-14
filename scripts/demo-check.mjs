// Loads migrations + demo seed into PGlite and prints a few totals (demo sanity check).
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile, readdir } from "node:fs/promises";
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`set timezone='UTC'; create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create table auth.users (id uuid primary key, email text, phone text, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema extensions; grant usage on schema public, extensions, auth to anon, authenticated, service_role; create publication supabase_realtime;`);
for (const f of (await readdir("supabase/migrations")).sort()) await db.exec(await readFile(`supabase/migrations/${f}`, "utf8"));
await db.exec(await readFile("supabase/seed/demo.sql", "utf8"));
const q = async (s) => (await db.query(s)).rows;
console.log(await q(`select * from wallet_summary('00000000-0000-4000-8000-00000000000a')`));
console.log(await q(`select number, title, status, (select count(*) from payouts p where p.episode_id=e.id and status='sent') paid, (select sum(amount) from payouts p where p.episode_id=e.id and status='sent') total from episodes e order by number`));
console.log(await q(`select recipient_display, amount, status, receipt_code from payouts where episode_id=(select id from episodes where number=12) order by created_at`));
