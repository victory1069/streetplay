-- StreetPlay initial schema.
-- Apply with the Supabase SQL editor (paste and run) or `npx supabase db push`.
--
-- Rules this schema enforces:
-- * Money is bigint kobo.
-- * Clients never write payouts or wallet entries. Those go through the API
--   (service role) and the security-definer functions below, which check
--   limits and balance under a per-creator lock.
-- * The wallet is an append-only ledger: balance = sum(wallet_entries.amount).
-- * Round seeds are committed before play and must hash to the commitment.

create extension if not exists pgcrypto with schema extensions;

-- =====================================================================
-- Helpers
-- =====================================================================

create or replace function public.random_code(p_len int)
returns text language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(p_len);
  result text := '';
begin
  for i in 0..p_len - 1 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return result;
end $$;

-- =====================================================================
-- Creators (one account = one show)
-- =====================================================================

create table public.creators (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  instagram_handle text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  kyc_status text not null default 'pending' check (kyc_status in ('pending', 'verified', 'rejected')),
  -- Payout limits (kobo). Defaults: ₦50k/round, ₦500k/episode, ₦1m/day,
  -- hold-to-send confirmation above ₦50k.
  limit_per_round bigint not null default 5000000 check (limit_per_round > 0),
  limit_per_episode bigint not null default 50000000 check (limit_per_episode > 0),
  limit_per_day bigint not null default 100000000 check (limit_per_day > 0),
  confirm_above bigint not null default 5000000 check (confirm_above >= 0),
  allow_repeat_winners boolean not null default true,
  created_at timestamptz not null default now()
);

-- The signed-in user owns this creator account.
create or replace function public.is_owner(p_creator uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_creator = auth.uid()
$$;

-- =====================================================================
-- Episodes, rounds, consent, clip markers
-- =====================================================================

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  status text not null default 'draft' check (status in ('draft', 'live', 'wrapped')),
  formats text[] not null default '{}',
  pack_ids text[] not null default '{}',
  budget bigint not null check (budget >= 0),
  round_cap bigint not null check (round_cap >= 0),
  live_code text unique default public.random_code(6),
  sponsor_name text,
  created_at timestamptz not null default now()
);
create index episodes_creator_idx on public.episodes (creator_id, created_at desc);

create or replace function public.owns_episode(p_episode uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.episodes e where e.id = p_episode and e.creator_id = auth.uid())
$$;

create table public.rounds (
  -- Client may supply the id so rounds created offline keep their identity.
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes (id) on delete cascade,
  format text not null,
  status text not null default 'setup'
    check (status in ('setup', 'playing', 'won', 'lost', 'walked-away', 'void')),
  prize_cap bigint not null check (prize_cap >= 0),
  prize_won bigint not null default 0 check (prize_won >= 0),
  participant_name text,
  commitment text check (commitment ~ '^[0-9a-f]{64}$'),
  seed text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index rounds_episode_idx on public.rounds (episode_id, created_at);

-- Fairness: commitment can't change once set, and any seed must hash to it.
create or replace function public.guard_round_fairness()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.commitment is not null and new.commitment is distinct from old.commitment then
    raise exception 'commitment_immutable';
  end if;
  if new.seed is not null and (
    new.commitment is null
    or encode(extensions.digest(new.seed, 'sha256'), 'hex') <> new.commitment
  ) then
    raise exception 'seed_does_not_match_commitment';
  end if;
  return new;
end $$;

create trigger rounds_fairness before insert or update on public.rounds
for each row execute function public.guard_round_fairness();

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  name_given text not null check (char_length(name_given) between 1 and 80),
  release_version text not null,
  agreed_at timestamptz not null default now()
);
create index consents_round_idx on public.consents (round_id);

create table public.clip_markers (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes (id) on delete cascade,
  round_id uuid references public.rounds (id) on delete set null,
  label text not null check (char_length(label) between 1 and 40),
  at timestamptz not null default now()
);
create index clip_markers_episode_idx on public.clip_markers (episode_id, at);

-- =====================================================================
-- Money: wallet ledger and payouts
-- =====================================================================

create table public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id),
  kind text not null check (kind in ('topup', 'payout', 'refund', 'withdrawal', 'adjustment')),
  amount bigint not null check (amount <> 0), -- signed: + credit, - debit
  reference text not null unique,             -- provider ref / payout id; makes writes idempotent
  payout_id uuid,
  created_at timestamptz not null default now()
);
create index wallet_entries_creator_idx on public.wallet_entries (creator_id);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  creator_id uuid not null references public.creators (id),
  episode_id uuid not null references public.episodes (id),
  round_id uuid references public.rounds (id),
  amount bigint not null check (amount > 0),
  account_number text not null check (account_number ~ '^\d{10}$'),
  bank_code text not null,
  account_name text not null, -- from the server's own name enquiry, never the client
  status text not null
    check (status in ('sending', 'sent', 'failed', 'reversed')),
  receipt_code text not null unique default public.random_code(6),
  provider_reference text,
  failure_reason text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index payouts_episode_idx on public.payouts (episode_id, created_at desc);
create index payouts_creator_day_idx on public.payouts (creator_id, created_at);
create index payouts_account_idx on public.payouts (creator_id, account_number, bank_code);

create or replace function public.wallet_balance(p_creator uuid)
returns bigint language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_owner(p_creator) then
    raise exception 'not_owner';
  end if;
  return coalesce((select sum(amount) from public.wallet_entries where creator_id = p_creator), 0);
end $$;

-- Records the provider's answer (API response or webhook). Refunds once on failure.
create or replace function public.mark_payout_result(
  p_payout uuid,
  p_status text,
  p_provider_reference text,
  p_failure_reason text
) returns public.payouts
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.payouts;
begin
  if p_status not in ('sending', 'sent', 'failed', 'reversed') then raise exception 'bad_status'; end if;

  select * into v_row from public.payouts where id = p_payout for update;
  if not found then raise exception 'payout_not_found'; end if;

  -- Only forward transitions: sending -> sent|failed, sent -> reversed.
  if not (
    (v_row.status = 'sending' and p_status in ('sending', 'sent', 'failed'))
    or (v_row.status = 'sent' and p_status = 'reversed')
  ) then
    return v_row;
  end if;

  update public.payouts set
    status = p_status,
    provider_reference = coalesce(p_provider_reference, provider_reference),
    failure_reason = p_failure_reason,
    sent_at = case when p_status = 'sent' then now() else sent_at end
  where id = p_payout
  returning * into v_row;

  if p_status in ('failed', 'reversed') then
    insert into public.wallet_entries (creator_id, kind, amount, reference, payout_id)
    values (v_row.creator_id, 'refund', v_row.amount, 'refund:' || v_row.id, v_row.id)
    on conflict (reference) do nothing;
  end if;
  return v_row;
end $$;

create or replace function public.record_topup(p_creator uuid, p_amount bigint, p_reference text)
returns void language sql security definer set search_path = '' as $$
  insert into public.wallet_entries (creator_id, kind, amount, reference)
  values (p_creator, 'topup', p_amount, p_reference)
  on conflict (reference) do nothing
$$;

-- Participant enters their own account by scanning a QR on the host's phone.
create table public.account_requests (
  token text primary key default encode(extensions.gen_random_bytes(16), 'hex'),
  episode_id uuid not null references public.episodes (id) on delete cascade,
  round_id uuid references public.rounds (id) on delete cascade,
  account_number text check (account_number ~ '^\d{10}$'),
  bank_code text,
  submitted_at timestamptz,
  expires_at timestamptz not null default now() + interval '15 minutes',
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Live mode
-- =====================================================================

create table public.live_prompts (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes (id) on delete cascade,
  round_id uuid references public.rounds (id) on delete set null,
  kind text not null check (kind in ('vote', 'predict', 'answer')),
  question text not null check (char_length(question) between 1 and 200),
  options text[] not null check (array_length(options, 1) between 2 and 6),
  status text not null default 'open' check (status in ('open', 'closed', 'resolved')),
  correct_option int, -- 0-based index, set by resolve_prompt
  opened_at timestamptz not null default now(),
  closes_at timestamptz
);
create index live_prompts_episode_idx on public.live_prompts (episode_id, opened_at desc);

create table public.viewers (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  token_hash text not null unique, -- sha256 of the viewer's cookie token
  points int not null default 0,
  created_at timestamptz not null default now()
);
create index viewers_leaderboard_idx on public.viewers (episode_id, points desc);

create table public.viewer_responses (
  prompt_id uuid not null references public.live_prompts (id) on delete cascade,
  viewer_id uuid not null references public.viewers (id) on delete cascade,
  option int not null check (option between 0 and 5),
  created_at timestamptz not null default now(),
  primary key (prompt_id, viewer_id) -- first answer counts
);

create or replace function public.live_session(p_code text)
returns table (episode_id uuid, title text, status text, creator_name text, sponsor_name text)
language sql stable security definer set search_path = '' as $$
  select e.id, e.title, e.status, c.display_name, e.sponsor_name
  from public.episodes e join public.creators c on c.id = e.creator_id
  where e.live_code = upper(p_code)
$$;

create or replace function public.live_leaderboard(p_episode uuid, p_limit int default 20)
returns table (display_name text, points int)
language sql stable security definer set search_path = '' as $$
  select display_name, points from public.viewers
  where episode_id = p_episode and points > 0
  order by points desc, created_at
  limit least(p_limit, 100)
$$;

create or replace function public.prompt_tally(p_prompt uuid)
returns table (option int, responses bigint)
language sql stable security definer set search_path = '' as $$
  select option, count(*) from public.viewer_responses where prompt_id = p_prompt group by option order by option
$$;

-- Votes: +1 for taking part. Predict/answer: +10 if correct, +5 more for the first 10 correct.
create or replace function public.resolve_prompt(p_prompt uuid, p_correct int)
returns public.live_prompts
language plpgsql security definer set search_path = '' as $$
declare
  v_prompt public.live_prompts;
begin
  select * into v_prompt from public.live_prompts where id = p_prompt for update;
  if not found then raise exception 'prompt_not_found'; end if;
  if not public.owns_episode(v_prompt.episode_id) then raise exception 'not_owner'; end if;
  if v_prompt.status = 'resolved' then return v_prompt; end if;

  if v_prompt.kind = 'vote' then
    update public.viewers v set points = points + 1
    from public.viewer_responses r where r.prompt_id = p_prompt and r.viewer_id = v.id;
  else
    if p_correct is null or p_correct < 0 or p_correct >= array_length(v_prompt.options, 1) then
      raise exception 'bad_option';
    end if;
    with ranked as (
      select viewer_id, row_number() over (order by created_at) as rn
      from public.viewer_responses where prompt_id = p_prompt and option = p_correct
    )
    update public.viewers v set points = points + 10 + case when r.rn <= 10 then 5 else 0 end
    from ranked r where r.viewer_id = v.id;
  end if;

  update public.live_prompts set status = 'resolved', correct_option = p_correct
  where id = p_prompt returning * into v_prompt;
  return v_prompt;
end $$;

-- =====================================================================
-- Public pages: receipts and fairness verify
-- =====================================================================

-- First name + initial only. NUBAN names are often SURNAME FIRST, so this
-- shows "Okafor A." for "OKAFOR ADAEZE"; good enough to not identify anyone.
create or replace function public.public_receipt(p_code text)
returns table (
  receipt_code text, amount bigint, recipient_display text, status text,
  sent_at timestamptz, episode_title text, creator_name text, round_format text, round_id uuid
)
language sql stable security definer set search_path = '' as $$
  select
    p.receipt_code,
    p.amount,
    initcap(split_part(p.account_name, ' ', 1))
      || coalesce(' ' || upper(left(nullif(split_part(p.account_name, ' ', 2), ''), 1)) || '.', ''),
    p.status,
    p.sent_at,
    e.title,
    c.display_name,
    r.format,
    r.id
  from public.payouts p
  join public.episodes e on e.id = p.episode_id
  join public.creators c on c.id = p.creator_id
  left join public.rounds r on r.id = p.round_id
  where p.receipt_code = upper(p_code) and p.status in ('sent', 'reversed')
$$;

-- Seed is only revealed once the round has ended.
create or replace function public.public_round(p_round uuid)
returns table (
  id uuid, format text, status text, commitment text, seed text,
  started_at timestamptz, ended_at timestamptz, episode_title text, creator_name text
)
language sql stable security definer set search_path = '' as $$
  select
    r.id, r.format, r.status, r.commitment,
    case when r.status in ('won', 'lost', 'walked-away', 'void') then r.seed end,
    r.started_at, r.ended_at, e.title, c.display_name
  from public.rounds r
  join public.episodes e on e.id = r.episode_id
  join public.creators c on c.id = e.creator_id
  where r.id = p_round
$$;

-- =====================================================================
-- Row level security
-- =====================================================================

alter table public.creators enable row level security;
alter table public.episodes enable row level security;
alter table public.rounds enable row level security;
alter table public.consents enable row level security;
alter table public.clip_markers enable row level security;
alter table public.wallet_entries enable row level security;
alter table public.payouts enable row level security;
alter table public.account_requests enable row level security;
alter table public.live_prompts enable row level security;
alter table public.viewers enable row level security;
alter table public.viewer_responses enable row level security;

create policy "owner reads creator" on public.creators for select to authenticated
  using (public.is_owner(id));
create policy "user creates own creator" on public.creators for insert to authenticated
  with check (id = auth.uid());
create policy "owner updates creator" on public.creators for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "owner reads episodes" on public.episodes for select to authenticated
  using (public.is_owner(creator_id));
create policy "owner creates episodes" on public.episodes for insert to authenticated
  with check (public.is_owner(creator_id));
create policy "owner updates episodes" on public.episodes for update to authenticated
  using (public.is_owner(creator_id)) with check (public.is_owner(creator_id));
create policy "owner deletes draft episodes" on public.episodes for delete to authenticated
  using (creator_id = auth.uid() and status = 'draft');

create policy "owner reads rounds" on public.rounds for select to authenticated
  using (public.owns_episode(episode_id));
create policy "owner creates rounds" on public.rounds for insert to authenticated
  with check (public.owns_episode(episode_id));
create policy "owner updates rounds" on public.rounds for update to authenticated
  using (public.owns_episode(episode_id)) with check (public.owns_episode(episode_id));

create policy "owner reads consents" on public.consents for select to authenticated
  using (exists (select 1 from public.rounds r where r.id = round_id and public.owns_episode(r.episode_id)));
create policy "owner records consents" on public.consents for insert to authenticated
  with check (exists (select 1 from public.rounds r where r.id = round_id and public.owns_episode(r.episode_id)));

create policy "owner reads markers" on public.clip_markers for select to authenticated
  using (public.owns_episode(episode_id));
create policy "owner adds markers" on public.clip_markers for insert to authenticated
  with check (public.owns_episode(episode_id));
create policy "owner removes markers" on public.clip_markers for delete to authenticated
  using (public.owns_episode(episode_id));

create policy "owner reads wallet" on public.wallet_entries for select to authenticated
  using (public.is_owner(creator_id));

create policy "owner reads payouts" on public.payouts for select to authenticated
  using (public.is_owner(creator_id));

create policy "owner reads account requests" on public.account_requests for select to authenticated
  using (public.owns_episode(episode_id));
create policy "owner creates account requests" on public.account_requests for insert to authenticated
  with check (public.owns_episode(episode_id));

create policy "anyone reads prompts" on public.live_prompts for select to anon, authenticated
  using (true);
create policy "owner opens prompts" on public.live_prompts for insert to authenticated
  with check (public.owns_episode(episode_id));
create policy "owner updates prompts" on public.live_prompts for update to authenticated
  using (public.owns_episode(episode_id)) with check (public.owns_episode(episode_id));

-- viewers and viewer_responses: no client policies. Written by the API,
-- read through live_leaderboard / prompt_tally.

-- =====================================================================
-- Grants: deny by default, then allow exactly what the app uses
-- =====================================================================

revoke all on all tables in schema public from anon, authenticated;

grant select on public.creators to authenticated;
grant insert (id, display_name, instagram_handle) on public.creators to authenticated;
grant update (display_name, instagram_handle, limit_per_round, limit_per_episode, limit_per_day,
              confirm_above, allow_repeat_winners) on public.creators to authenticated;

grant select, delete on public.episodes to authenticated;
grant insert (id, creator_id, title, formats, pack_ids, budget, round_cap, sponsor_name) on public.episodes to authenticated;
grant update (title, status, formats, pack_ids, budget, round_cap, sponsor_name)
  on public.episodes to authenticated;

grant select on public.rounds to authenticated;
grant insert (id, episode_id, format, status, prize_cap, prize_won, participant_name, commitment, seed, started_at, ended_at)
  on public.rounds to authenticated;
grant update (status, prize_won, participant_name, commitment, seed, started_at, ended_at) on public.rounds to authenticated;

grant select, insert on public.consents to authenticated;
grant select, insert, delete on public.clip_markers to authenticated;
grant select on public.wallet_entries to authenticated;
grant select on public.payouts to authenticated;
grant select on public.account_requests to authenticated;
grant insert (episode_id, round_id) on public.account_requests to authenticated;

grant select on public.live_prompts to anon, authenticated;
grant insert (episode_id, round_id, kind, question, options, closes_at) on public.live_prompts to authenticated;
grant update (status, closes_at) on public.live_prompts to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.random_code(int) to authenticated, service_role;
grant execute on function public.is_owner(uuid) to authenticated;
grant execute on function public.owns_episode(uuid) to authenticated;
grant execute on function public.wallet_balance(uuid) to authenticated, service_role;
grant execute on function public.resolve_prompt(uuid, int) to authenticated;
grant execute on function public.live_session(text) to anon, authenticated;
grant execute on function public.live_leaderboard(uuid, int) to anon, authenticated;
grant execute on function public.prompt_tally(uuid) to anon, authenticated;
grant execute on function public.public_receipt(text) to anon, authenticated;
grant execute on function public.public_round(uuid) to anon, authenticated;

grant execute on function public.mark_payout_result(uuid, text, text, text) to service_role;
grant execute on function public.record_topup(uuid, bigint, text) to service_role;

-- =====================================================================
-- Realtime: rows the screens subscribe to
-- =====================================================================

alter publication supabase_realtime add table
  public.episodes,       -- host sees producer's push-to-host message
  public.live_prompts,   -- viewer page sees the current question
  public.account_requests, -- host sees participant's account arrive
  public.payouts;        -- payout status changes (sent / failed)
