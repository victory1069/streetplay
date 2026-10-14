-- StreetPlay: everything the designed screens need, on top of the init schema.
-- Run after 20261007000000_init.sql (SQL editor or `npx supabase db push`).
--
-- Adds: profiles, KYC and per-creator virtual accounts,
-- episode planning (number, place, time, per-format plan, per-episode limits),
-- payout fees, held/claimable payouts (bankless winners, viewer prizes),
-- withdrawals, the participant QR flow, fans who persist across a creator's
-- Lives with speed/streak scoring, push subscriptions, SMS log, rate limits
-- and data-deletion.

-- =====================================================================
-- Profiles (the person behind the show)
-- =====================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "create own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- =====================================================================
-- Creators: handle, KYC, virtual account
-- =====================================================================

alter table public.creators
  add column phone text,
  add column bvn_last4 text,
  add column bvn_name text,
  add column return_bank_code text,
  add column return_account_number text check (return_account_number ~ '^\d{10}$'),
  add column return_account_name text,
  add column selfie_path text,
  add column kyc_submitted_at timestamptz,
  add column provider_customer_code text unique,
  add column virtual_account_number text,
  add column virtual_account_bank text,
  add column virtual_account_name text,
  add column default_episode_id uuid,
  add constraint creators_handle_format check (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9._]{2,30}$');

create unique index creators_handle_idx on public.creators (lower(instagram_handle));

grant update (default_episode_id) on public.creators to authenticated;

-- =====================================================================
-- Episodes: number, place, time, plan, limits
-- =====================================================================

alter table public.episodes
  add column number int,
  add column location text check (char_length(location) <= 80),
  add column starts_at timestamptz,
  add column format_plan jsonb not null default '{}',
  add column max_payout bigint check (max_payout > 0),
  -- Above this, the host must hold SEND to confirm (no second person).
  add column confirm_above bigint check (confirm_above >= 0),
  add column repeat_policy text not null default 'flag' check (repeat_policy in ('allow', 'flag', 'block')),
  add column public_code text unique default public.random_code(6),
  add column live_state jsonb not null default '{}',
  add column wrapped_at timestamptz;

alter table public.episodes alter column round_cap set default 0;

alter table public.creators
  add constraint creators_default_episode_fk foreign key (default_episode_id) references public.episodes (id) on delete set null;

update public.episodes e set number = n.rn
from (select id, row_number() over (partition by creator_id order by created_at) rn from public.episodes) n
where n.id = e.id;

create or replace function public.number_episode()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.number is null then
    perform pg_advisory_xact_lock(hashtextextended('ep:' || new.creator_id::text, 0));
    select coalesce(max(number), 0) + 1 into new.number from public.episodes where creator_id = new.creator_id;
  end if;
  return new;
end $$;

create trigger episodes_number before insert on public.episodes
for each row execute function public.number_episode();

create unique index episodes_creator_number_idx on public.episodes (creator_id, number);

grant insert (location, starts_at, format_plan, max_payout, confirm_above, repeat_policy) on public.episodes to authenticated;
grant update (location, starts_at, format_plan, max_payout, confirm_above, repeat_policy, live_state, wrapped_at)
  on public.episodes to authenticated;

-- =====================================================================
-- Rounds: number, summary, result
-- =====================================================================

alter table public.rounds
  add column number int,
  add column summary text check (char_length(summary) <= 120),
  add column result jsonb not null default '{}';

update public.rounds r set number = n.rn
from (select id, row_number() over (partition by episode_id order by created_at) rn from public.rounds) n
where n.id = r.id;

create or replace function public.number_round()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.number is null then
    perform pg_advisory_xact_lock(hashtextextended('rd:' || new.episode_id::text, 0));
    select coalesce(max(number), 0) + 1 into new.number from public.rounds where episode_id = new.episode_id;
  end if;
  return new;
end $$;

create trigger rounds_number before insert on public.rounds
for each row execute function public.number_round();

grant insert (summary, result) on public.rounds to authenticated;
grant update (summary, result) on public.rounds to authenticated;

-- =====================================================================
-- Money: fees, funding sources, held payouts, withdrawals
-- =====================================================================

alter table public.wallet_entries drop constraint wallet_entries_kind_check;
alter table public.wallet_entries add constraint wallet_entries_kind_check
  check (kind in ('topup', 'sponsor', 'payout', 'fee', 'refund', 'withdrawal', 'adjustment'));
alter table public.wallet_entries
  add column episode_id uuid references public.episodes (id) on delete set null,
  add column counterparty text,
  add column note text,
  add constraint wallet_entries_payout_fk foreign key (payout_id) references public.payouts (id);

-- Participant QR flow (reworked): participant checks their own name.
alter table public.account_requests
  add column code text unique default public.random_code(6),
  add column amount bigint check (amount > 0),
  add column participant_name text check (char_length(participant_name) <= 60),
  add column account_name text,
  add column status text not null default 'waiting' check (status in ('waiting', 'named', 'confirmed', 'paid', 'cancelled')),
  add column phone text,
  add column payout_id uuid;
alter table public.account_requests alter column expires_at set default now() + interval '30 minutes';
grant insert (amount, participant_name) on public.account_requests to authenticated;
alter table public.payouts drop constraint payouts_status_check;
alter table public.payouts add constraint payouts_status_check
  check (status in ('held', 'sending', 'sent', 'failed', 'reversed', 'expired'));
alter table public.payouts
  alter column account_number drop not null,
  alter column bank_code drop not null,
  alter column account_name drop not null,
  add column kind text not null default 'participant' check (kind in ('participant', 'viewer')),
  add column channel text not null default 'bank' check (channel in ('bank', 'airtime')),
  add column recipient_display text,
  add column recipient_phone text,
  add column fee bigint not null default 0 check (fee >= 0),
  add column repeat_winner boolean not null default false,
  add column claim_code text unique,
  add column claim_expires_at timestamptz,
  add column account_request_token text references public.account_requests (token) on delete set null,
  add column fan_id uuid,
  add column anonymized_at timestamptz;
alter table public.payouts add constraint payouts_recipient_present check (
  status in ('held', 'expired')
  or anonymized_at is not null
  or (channel = 'bank' and account_number is not null)
  or (channel = 'airtime' and recipient_phone is not null)
);
-- A round has one winner: at most one live participant payout per round,
-- so a double tap or a second phone can't pay the same win twice.
create unique index payouts_one_per_round on public.payouts (round_id)
  where kind = 'participant' and round_id is not null and status in ('held', 'sending', 'sent');

alter table public.account_requests
  add constraint account_requests_payout_fk foreign key (payout_id) references public.payouts (id) on delete set null;

-- Spend that counts against limits: anything not refunded.
create or replace function public.live_payout_statuses()
returns text[] language sql immutable as $$ select array['held', 'sending', 'sent'] $$;

-- Creates a payout and reserves amount + fee, atomically. Fields in p:
-- idempotency_key, episode_id, round_id?, amount, fee?, channel?, kind?,
-- account_number?, bank_code?, account_name?, recipient_display?,
-- recipient_phone?, account_request_token?, fan_id?,
-- hold? (claim later), claim_code?, claim_hours?
create or replace function public.create_payout(p_user uuid, p jsonb, p_require_kyc boolean)
returns public.payouts
language plpgsql security definer set search_path = '' as $$
declare
  v_key text := p ->> 'idempotency_key';
  v_episode uuid := (p ->> 'episode_id')::uuid;
  v_round uuid := nullif(p ->> 'round_id', '')::uuid;
  v_amount bigint := (p ->> 'amount')::bigint;
  v_fee bigint := coalesce((p ->> 'fee')::bigint, 0);
  v_hold boolean := coalesce((p ->> 'hold')::boolean, false);
  v_channel text := coalesce(p ->> 'channel', 'bank');
  v_acct text := nullif(p ->> 'account_number', '');
  v_bank text := nullif(p ->> 'bank_code', '');
  v_ep public.episodes;
  v_creator public.creators;
  v_round_row public.rounds;
  v_row public.payouts;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
  v_repeat boolean := false;
  v_status text;
begin
  if v_key is null then raise exception 'bad_request'; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'bad_amount'; end if;

  select * into v_row from public.payouts where idempotency_key = v_key;
  if found then return v_row; end if;

  select * into v_ep from public.episodes where id = v_episode;
  if not found then raise exception 'episode_not_found'; end if;
  if v_ep.creator_id <> p_user then raise exception 'not_owner'; end if;
  if v_round is not null then
    select * into v_round_row from public.rounds where id = v_round and episode_id = v_episode;
    if not found then raise exception 'round_not_in_episode'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_ep.creator_id::text, 0));

  select * into v_row from public.payouts where idempotency_key = v_key;
  if found then return v_row; end if;

  select * into v_creator from public.creators where id = v_ep.creator_id;
  if p_require_kyc and v_creator.kyc_status <> 'verified' then raise exception 'kyc_not_verified'; end if;
  if v_ep.status = 'wrapped' then raise exception 'episode_wrapped'; end if;

  if v_amount > coalesce(v_ep.max_payout, v_creator.limit_per_round) then raise exception 'payout_limit'; end if;

  if v_round is not null and v_round_row.prize_cap > 0 and v_amount + coalesce((
    select sum(amount) from public.payouts where round_id = v_round and status = any (public.live_payout_statuses())
  ), 0) > v_round_row.prize_cap then
    raise exception 'round_limit';
  end if;

  if v_ep.budget > 0 and v_amount + coalesce((
    select sum(amount) from public.payouts where episode_id = v_episode and status = any (public.live_payout_statuses())
  ), 0) > least(v_ep.budget, v_creator.limit_per_episode) then
    raise exception 'episode_limit';
  end if;

  if v_amount + coalesce((
    select sum(amount) from public.payouts
    where creator_id = v_creator.id and created_at >= v_day_start and status = any (public.live_payout_statuses())
  ), 0) > v_creator.limit_per_day then
    raise exception 'day_limit';
  end if;

  if v_acct is not null then
    v_repeat := exists (
      select 1 from public.payouts
      where creator_id = v_creator.id and account_number = v_acct and bank_code = v_bank
        and status in ('sending', 'sent') and episode_id <> v_episode
    );
    if v_repeat and (v_ep.repeat_policy = 'block' or not v_creator.allow_repeat_winners) then
      raise exception 'repeat_winner';
    end if;
  end if;

  if v_amount + v_fee > coalesce((select sum(amount) from public.wallet_entries where creator_id = v_creator.id), 0) then
    raise exception 'insufficient_balance';
  end if;

  -- Big payouts and flagged repeat winners are confirmed on the host's
  -- screen (hold to send) before this is called; here they just go.
  v_status := case when v_hold then 'held' else 'sending' end;

  insert into public.payouts (
    idempotency_key, creator_id, episode_id, round_id, amount, fee, channel, kind,
    account_number, bank_code, account_name, recipient_display, recipient_phone,
    account_request_token, fan_id, repeat_winner, status, created_by, claim_code, claim_expires_at
  ) values (
    v_key, v_creator.id, v_episode, v_round, v_amount, v_fee, v_channel, coalesce(p ->> 'kind', 'participant'),
    v_acct, v_bank, nullif(p ->> 'account_name', ''), nullif(p ->> 'recipient_display', ''), nullif(p ->> 'recipient_phone', ''),
    nullif(p ->> 'account_request_token', ''), nullif(p ->> 'fan_id', '')::uuid, v_repeat, v_status, p_user,
    case when v_hold then p ->> 'claim_code' end,
    case when v_hold then now() + make_interval(hours => coalesce((p ->> 'claim_hours')::int, 168)) end
  ) returning * into v_row;

  insert into public.wallet_entries (creator_id, kind, amount, reference, payout_id, episode_id)
  values (v_creator.id, 'payout', -v_amount, 'payout:' || v_row.id, v_row.id, v_episode);
  if v_fee > 0 then
    insert into public.wallet_entries (creator_id, kind, amount, reference, payout_id, episode_id)
    values (v_creator.id, 'fee', -v_fee, 'fee:' || v_row.id, v_row.id, v_episode);
  end if;

  if v_row.account_request_token is not null then
    update public.account_requests set status = 'paid', payout_id = v_row.id where token = v_row.account_request_token;
  end if;

  return v_row;
end $$;

-- One refund per payout, covering amount + fee.
create or replace function public.refund_payout(v_row public.payouts)
returns void language sql security definer set search_path = '' as $$
  insert into public.wallet_entries (creator_id, kind, amount, reference, payout_id, episode_id)
  values (v_row.creator_id, 'refund', v_row.amount + v_row.fee, 'refund:' || v_row.id, v_row.id, v_row.episode_id)
  on conflict (reference) do nothing
$$;

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

  if not (
    (v_row.status = 'sending' and p_status in ('sending', 'sent', 'failed'))
    or (v_row.status = 'sent' and p_status = 'reversed')
  ) then
    return v_row;
  end if;

  -- A claimed prize whose transfer failed (wrong account, bank down) goes
  -- back to "held" so the winner can claim again; it still expires and
  -- refunds as normal if they never do.
  if p_status = 'failed' and v_row.claim_code is not null and v_row.claim_expires_at > now() then
    update public.payouts set
      status = 'held', account_number = null, bank_code = null, account_name = null,
      failure_reason = p_failure_reason
    where id = p_payout
    returning * into v_row;
    return v_row;
  end if;

  update public.payouts set
    status = p_status,
    provider_reference = coalesce(p_provider_reference, provider_reference),
    failure_reason = p_failure_reason,
    sent_at = case when p_status = 'sent' then now() else sent_at end
  where id = p_payout
  returning * into v_row;

  if p_status in ('failed', 'reversed') then perform public.refund_payout(v_row); end if;
  return v_row;
end $$;

-- A held payout (bankless winner or viewer prize) gets its destination.
create or replace function public.claim_payout(
  p_code text, p_channel text, p_account_number text, p_bank_code text,
  p_account_name text, p_recipient_display text, p_phone text
) returns public.payouts
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.payouts;
begin
  select * into v_row from public.payouts where claim_code = p_code for update;
  if not found then raise exception 'bad_claim_code'; end if;
  if v_row.status <> 'held' then raise exception 'already_claimed'; end if;
  if v_row.claim_expires_at < now() then
    -- Return instead of raising: a raise would roll back the refund.
    update public.payouts set status = 'expired' where id = v_row.id returning * into v_row;
    perform public.refund_payout(v_row);
    return v_row;
  end if;
  if p_channel = 'bank' and (p_account_number is null or p_account_number !~ '^\d{10}$') then raise exception 'bad_account'; end if;
  if p_channel = 'airtime' and p_phone is null then raise exception 'bad_phone'; end if;

  update public.payouts set
    status = 'sending',
    channel = p_channel,
    account_number = case when p_channel = 'bank' then p_account_number end,
    bank_code = case when p_channel = 'bank' then p_bank_code end,
    account_name = p_account_name,
    recipient_display = coalesce(p_recipient_display, recipient_display),
    recipient_phone = coalesce(p_phone, recipient_phone)
  where id = v_row.id
  returning * into v_row;
  return v_row;
end $$;

-- Expired claims go back to the wallet. Safe to call any time.
create or replace function public.release_expired_claims()
returns int language plpgsql security definer set search_path = '' as $$
declare
  r public.payouts;
  v_count int := 0;
begin
  for r in
    update public.payouts set status = 'expired'
    where status = 'held' and claim_expires_at < now()
    returning *
  loop
    perform public.refund_payout(r);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Top-ups, sponsor money and transfers into the virtual account.
create or replace function public.record_funding(
  p_creator uuid, p_amount bigint, p_reference text, p_kind text, p_episode uuid, p_counterparty text
) returns void language sql security definer set search_path = '' as $$
  insert into public.wallet_entries (creator_id, kind, amount, reference, episode_id, counterparty)
  values (p_creator, p_kind, p_amount, p_reference, p_episode, p_counterparty)
  on conflict (reference) do nothing
$$;

-- Balance split into money promised to unwrapped episodes and free money.
create or replace function public.wallet_summary(p_creator uuid)
returns table (balance bigint, assigned bigint, free bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_balance bigint;
  v_assigned bigint;
begin
  if auth.uid() is not null and not public.is_owner(p_creator) then raise exception 'not_owner'; end if;
  v_balance := coalesce((select sum(amount) from public.wallet_entries where creator_id = p_creator), 0);
  v_assigned := coalesce((
    select sum(greatest(0, e.budget - coalesce((
      select sum(p.amount) from public.payouts p
      where p.episode_id = e.id and p.status = any (public.live_payout_statuses())
    ), 0)))
    from public.episodes e where e.creator_id = p_creator and e.status <> 'wrapped'
  ), 0);
  v_assigned := least(v_assigned, greatest(v_balance, 0));
  return query select v_balance, v_assigned, v_balance - v_assigned;
end $$;

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id),
  amount bigint not null check (amount > 0),
  fee bigint not null default 0 check (fee >= 0),
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  account_number text not null,
  bank_code text not null,
  account_name text not null,
  provider_reference text,
  failure_reason text,
  episode_id uuid references public.episodes (id) on delete set null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.withdrawals enable row level security;
create policy "owner reads withdrawals" on public.withdrawals for select to authenticated using (public.is_owner(creator_id));

-- Owner sends free money back to their verified return account.
create or replace function public.create_withdrawal(p_user uuid, p_amount bigint, p_fee bigint, p_episode uuid, p_require_kyc boolean)
returns public.withdrawals
language plpgsql security definer set search_path = '' as $$
declare
  v_creator public.creators;
  v_row public.withdrawals;
begin
  select * into v_creator from public.creators where id = p_user;
  if not found then raise exception 'not_owner'; end if;
  if p_require_kyc and v_creator.kyc_status <> 'verified' then raise exception 'kyc_not_verified'; end if;
  if v_creator.return_account_number is null then raise exception 'no_return_account'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_creator.id::text, 0));
  if p_amount + p_fee > coalesce((select sum(amount) from public.wallet_entries where creator_id = v_creator.id), 0) then
    raise exception 'insufficient_balance';
  end if;

  insert into public.withdrawals (creator_id, amount, fee, account_number, bank_code, account_name, episode_id, created_by)
  values (v_creator.id, p_amount, p_fee, v_creator.return_account_number, v_creator.return_bank_code,
          coalesce(v_creator.return_account_name, v_creator.bvn_name, ''), p_episode, p_user)
  returning * into v_row;

  insert into public.wallet_entries (creator_id, kind, amount, reference, episode_id, counterparty)
  values (v_creator.id, 'withdrawal', -(p_amount + p_fee), 'withdrawal:' || v_row.id, p_episode, v_row.account_name);
  return v_row;
end $$;

create or replace function public.mark_withdrawal_result(p_id uuid, p_status text, p_provider_reference text, p_failure_reason text)
returns public.withdrawals
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.withdrawals;
begin
  if p_status not in ('sending', 'sent', 'failed') then raise exception 'bad_status'; end if;
  select * into v_row from public.withdrawals where id = p_id for update;
  if not found then raise exception 'withdrawal_not_found'; end if;
  if v_row.status <> 'sending' then return v_row; end if;

  update public.withdrawals set
    status = p_status,
    provider_reference = coalesce(p_provider_reference, provider_reference),
    failure_reason = p_failure_reason,
    sent_at = case when p_status = 'sent' then now() end
  where id = p_id returning * into v_row;

  if p_status = 'failed' then
    insert into public.wallet_entries (creator_id, kind, amount, reference, episode_id)
    values (v_row.creator_id, 'refund', v_row.amount + v_row.fee, 'refund:withdrawal:' || v_row.id, v_row.episode_id)
    on conflict (reference) do nothing;
  end if;
  return v_row;
end $$;

-- Participant data deletion (NDPA). Keeps amount, date, receipt code.
create or replace function public.anonymize_payout(p_receipt_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_row public.payouts;
begin
  update public.payouts set
    account_number = null, account_name = null, recipient_display = null, recipient_phone = null,
    anonymized_at = now()
  where receipt_code = upper(p_receipt_code)
  returning * into v_row;
  if not found then raise exception 'receipt_not_found'; end if;

  if v_row.round_id is not null then
    update public.rounds set participant_name = null where id = v_row.round_id;
    update public.consents set name_given = '[deleted]' where round_id = v_row.round_id;
  end if;
  if v_row.account_request_token is not null then
    update public.account_requests set account_number = null, account_name = null, participant_name = null, phone = null
    where token = v_row.account_request_token;
  end if;
end $$;

-- =====================================================================
-- Live mode v2: fans persist across a creator's Lives
-- =====================================================================

drop function if exists public.resolve_prompt(uuid, int);
drop function if exists public.live_leaderboard(uuid, int);
drop function if exists public.prompt_tally(uuid);
drop function if exists public.live_session(text);
drop table if exists public.viewer_responses;
drop table if exists public.viewers;

create table public.fans (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  token_hash text not null unique,
  phone text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index fans_creator_idx on public.fans (creator_id);

create table public.fan_scores (
  episode_id uuid not null references public.episodes (id) on delete cascade,
  fan_id uuid not null references public.fans (id) on delete cascade,
  points int not null default 0,
  streak int not null default 0,
  best_streak int not null default 0,
  correct int not null default 0,
  answered int not null default 0,
  joined_at timestamptz not null default now(),
  primary key (episode_id, fan_id)
);
create index fan_scores_board_idx on public.fan_scores (episode_id, points desc);

alter table public.payouts add constraint payouts_fan_fk foreign key (fan_id) references public.fans (id) on delete set null;

alter table public.live_prompts drop constraint live_prompts_kind_check;
alter table public.live_prompts add constraint live_prompts_kind_check check (kind in ('vote', 'predict', 'quiz', 'text'));
alter table public.live_prompts drop constraint live_prompts_options_check;
alter table public.live_prompts alter column options set default '{}';
alter table public.live_prompts add constraint live_prompts_options_check
  check ((kind = 'text' and coalesce(array_length(options, 1), 0) = 0) or array_length(options, 1) between 2 and 6);
alter table public.live_prompts
  add column label text check (char_length(label) <= 60),
  add column round_number int,
  add column duration_seconds int check (duration_seconds between 5 and 600),
  add column reveal_note text check (char_length(reveal_note) <= 200),
  add column resolved_at timestamptz;
grant insert (label, round_number, duration_seconds) on public.live_prompts to authenticated;

-- Answers viewers must not see before the reveal.
create table public.live_prompt_secrets (
  prompt_id uuid primary key references public.live_prompts (id) on delete cascade,
  correct_option int,
  answer text,
  artist text
);
alter table public.live_prompt_secrets enable row level security;
create policy "owner manages secrets" on public.live_prompt_secrets for all to authenticated
  using (exists (select 1 from public.live_prompts p where p.id = prompt_id and public.owns_episode(p.episode_id)))
  with check (exists (select 1 from public.live_prompts p where p.id = prompt_id and public.owns_episode(p.episode_id)));

create table public.fan_responses (
  prompt_id uuid not null references public.live_prompts (id) on delete cascade,
  fan_id uuid not null references public.fans (id) on delete cascade,
  option int check (option between 0 and 5),
  text_answer text check (char_length(text_answer) <= 120),
  correct boolean,
  points int not null default 0,
  created_at timestamptz not null default now(),
  primary key (prompt_id, fan_id)
);

-- Records a response and scores it. First response counts. Called by the API
-- after it has judged correctness (it can read the secret answer).
create or replace function public.record_response(
  p_prompt uuid, p_fan uuid, p_option int, p_text text, p_correct boolean, p_points int, p_double_first int
) returns table (inserted boolean, points int, correct boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_episode uuid;
  v_points int := p_points;
  v_existing public.fan_responses;
begin
  select episode_id into v_episode from public.live_prompts where id = p_prompt;
  if v_episode is null then raise exception 'prompt_not_found'; end if;

  if p_correct is true and p_double_first > 0 and (
    select count(*) from public.fan_responses where prompt_id = p_prompt and fan_responses.correct
  ) < p_double_first then
    v_points := v_points * 2;
  end if;

  insert into public.fan_responses (prompt_id, fan_id, option, text_answer, correct, points)
  values (p_prompt, p_fan, p_option, p_text, p_correct, v_points)
  on conflict do nothing;

  if not found then
    select * into v_existing from public.fan_responses where prompt_id = p_prompt and fan_id = p_fan;
    return query select false, v_existing.points, v_existing.correct;
    return;
  end if;

  insert into public.fan_scores (episode_id, fan_id) values (v_episode, p_fan) on conflict do nothing;
  update public.fan_scores set
    points = fan_scores.points + v_points,
    answered = answered + 1,
    correct = fan_scores.correct + (p_correct is true)::int,
    streak = case when p_correct is true then streak + 1 when p_correct is false then 0 else streak end,
    best_streak = greatest(best_streak, case when p_correct is true then streak + 1 else 0 end)
  where episode_id = v_episode and fan_id = p_fan;

  return query select true, v_points, p_correct;
end $$;

-- Reveal. Predictions score here (+100 if right); quiz/text scored on answer.
create or replace function public.resolve_prompt(p_prompt uuid, p_correct int, p_note text)
returns public.live_prompts
language plpgsql security definer set search_path = '' as $$
declare
  v_prompt public.live_prompts;
  v_correct int := p_correct;
begin
  select * into v_prompt from public.live_prompts where id = p_prompt for update;
  if not found then raise exception 'prompt_not_found'; end if;
  if not public.owns_episode(v_prompt.episode_id) then raise exception 'not_owner'; end if;
  if v_prompt.status = 'resolved' then return v_prompt; end if;

  if v_prompt.kind = 'quiz' and v_correct is null then
    select correct_option into v_correct from public.live_prompt_secrets where prompt_id = p_prompt;
  end if;

  if v_prompt.kind = 'predict' then
    if v_correct is null or v_correct < 0 or v_correct >= array_length(v_prompt.options, 1) then
      raise exception 'bad_option';
    end if;
    update public.fan_responses set correct = (option = v_correct), points = case when option = v_correct then 100 else 0 end
    where prompt_id = p_prompt;
    update public.fan_scores s set
      points = s.points + case when r.option = v_correct then 100 else 0 end,
      correct = s.correct + (r.option = v_correct)::int,
      streak = case when r.option = v_correct then s.streak + 1 else 0 end,
      best_streak = greatest(s.best_streak, case when r.option = v_correct then s.streak + 1 else 0 end)
    from public.fan_responses r
    where r.prompt_id = p_prompt and s.fan_id = r.fan_id and s.episode_id = v_prompt.episode_id;
  end if;

  update public.live_prompts set
    status = 'resolved', correct_option = v_correct, reveal_note = p_note, resolved_at = now()
  where id = p_prompt returning * into v_prompt;
  return v_prompt;
end $$;

-- Split for bars, and answered/correct counts for text and quiz prompts.
create or replace function public.prompt_stats(p_prompt uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'answered', count(*),
    'correct', count(*) filter (where correct),
    'options', coalesce(
      (select jsonb_agg(c order by o) from (
        select o, (select count(*) from public.fan_responses r2 where r2.prompt_id = p_prompt and r2.option = o) c
        from generate_series(0, 5) o
      ) t),
      '[]'::jsonb)
  )
  from public.fan_responses where prompt_id = p_prompt
$$;

-- The creator's current Live (or latest episode) for /play/[handle].
create or replace function public.live_session(p_handle text)
returns table (
  creator_id uuid, creator_name text, handle text, episode_id uuid, episode_number int, title text,
  location text, status text, sponsor_name text, live_state jsonb, players bigint, wrapped_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.display_name, c.instagram_handle, e.id, e.number, e.title, e.location, e.status, e.sponsor_name,
         e.live_state, (select count(*) from public.fan_scores s where s.episode_id = e.id), e.wrapped_at
  from public.creators c
  left join lateral (
    select * from public.episodes e
    where e.creator_id = c.id and e.status in ('live', 'wrapped')
    order by (e.status = 'live') desc, e.created_at desc
    limit 1
  ) e on true
  where lower(c.instagram_handle) = lower(p_handle)
$$;

-- period: 'live' (one episode), 'month' (this calendar month), 'all'.
create or replace function public.live_leaderboard(p_creator uuid, p_episode uuid, p_period text, p_limit int)
returns table (rank bigint, display_name text, points bigint, best_streak int)
language sql stable security definer set search_path = '' as $$
  with scored as (
    select f.id, f.display_name, sum(s.points) as points, max(s.best_streak) as best_streak, min(f.created_at) as since
    from public.fan_scores s
    join public.fans f on f.id = s.fan_id
    join public.episodes e on e.id = s.episode_id
    where e.creator_id = p_creator
      and case p_period
        when 'live' then s.episode_id = p_episode
        when 'month' then e.created_at >= date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos'
        else true
      end
    group by f.id, f.display_name
    having sum(s.points) > 0
  )
  select rank() over (order by points desc), display_name, points, best_streak
  from scored order by points desc, since limit least(p_limit, 100)
$$;

-- Rank of one fan (service role; the API resolves the fan from its cookie).
create or replace function public.fan_rank(p_episode uuid, p_fan uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select 1 + count(*) from public.fan_scores
  where episode_id = p_episode
    and points > coalesce((select points from public.fan_scores where episode_id = p_episode and fan_id = p_fan), 0)
$$;

-- =====================================================================
-- Public pages
-- =====================================================================

drop function if exists public.public_receipt(text);

-- Receipts: first name + initial (set by the API), never account numbers.
-- Includes pending payouts so the participant's page can say "locked in".
create or replace function public.public_receipt(p_code text)
returns table (
  receipt_code text, amount bigint, recipient_display text, status text, channel text, kind text,
  created_at timestamptz, sent_at timestamptz, provider_confirmed boolean, account_last2 text, bank_code text,
  phone_last4 text, anonymized boolean,
  episode_title text, episode_number int, episode_code text, sponsor_name text,
  creator_name text, creator_handle text,
  round_id uuid, round_number int, round_format text, commitment text, seed_sealed_at timestamptz,
  consent_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select
    p.receipt_code, p.amount,
    case when p.anonymized_at is not null then null else p.recipient_display end,
    p.status, p.channel, p.kind, p.created_at, p.sent_at, p.provider_reference is not null,
    right(p.account_number, 2), p.bank_code, right(p.recipient_phone, 4), p.anonymized_at is not null,
    e.title, e.number, e.public_code, e.sponsor_name,
    c.display_name, c.instagram_handle,
    r.id, r.number, r.format, r.commitment, r.started_at,
    (select min(agreed_at) from public.consents k where k.round_id = r.id)
  from public.payouts p
  join public.episodes e on e.id = p.episode_id
  join public.creators c on c.id = p.creator_id
  left join public.rounds r on r.id = p.round_id
  where p.receipt_code = upper(p_code)
    and p.status in ('sending', 'sent', 'reversed')
$$;

-- Episode receipts page (/e/[code]): the caption "verify" link.
create or replace function public.public_episode(p_code text)
returns table (
  episode_id uuid, title text, number int, location text, starts_at timestamptz, status text, wrapped_at timestamptz,
  creator_name text, creator_handle text, sponsor_name text,
  paid_total bigint, paid_count bigint, confirmed_count bigint, rounds_count bigint, seeds_revealed bigint, left_over bigint
)
language sql stable security definer set search_path = '' as $$
  select e.id, e.title, e.number, e.location, e.starts_at, e.status, e.wrapped_at,
    c.display_name, c.instagram_handle, e.sponsor_name,
    coalesce((select sum(amount) from public.payouts p where p.episode_id = e.id and p.status = 'sent'), 0),
    (select count(*) from public.payouts p where p.episode_id = e.id and p.status = 'sent'),
    (select count(*) from public.payouts p where p.episode_id = e.id and p.status = 'sent' and p.provider_reference is not null),
    (select count(*) from public.rounds r where r.episode_id = e.id and r.status not in ('setup', 'playing')),
    (select count(*) from public.rounds r where r.episode_id = e.id and r.status in ('won', 'lost', 'walked-away', 'void') and r.seed is not null),
    greatest(0, e.budget - coalesce((select sum(amount) from public.payouts p where p.episode_id = e.id and p.status = 'sent'), 0))
  from public.episodes e join public.creators c on c.id = e.creator_id
  where e.public_code = upper(p_code)
$$;

create or replace function public.public_episode_payouts(p_code text)
returns table (
  created_at timestamptz, recipient_display text, round_number int, round_format text,
  amount bigint, receipt_code text, status text
)
language sql stable security definer set search_path = '' as $$
  select p.created_at, case when p.anonymized_at is not null then null else p.recipient_display end,
    r.number, r.format, p.amount, p.receipt_code, p.status
  from public.payouts p
  join public.episodes e on e.id = p.episode_id
  left join public.rounds r on r.id = p.round_id
  where e.public_code = upper(p_code) and p.status in ('sending', 'sent', 'reversed')
  order by p.created_at
$$;

drop function if exists public.public_round(uuid);
create or replace function public.public_round(p_round uuid)
returns table (
  id uuid, number int, format text, status text, commitment text, seed text, result jsonb,
  started_at timestamptz, ended_at timestamptz, episode_title text, episode_number int, creator_name text, creator_handle text
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.number, r.format, r.status, r.commitment,
    case when r.status in ('won', 'lost', 'walked-away', 'void') then r.seed end,
    case when r.status in ('won', 'lost', 'walked-away', 'void') then r.result else '{}'::jsonb end,
    r.started_at, r.ended_at, e.title, e.number, c.display_name, c.instagram_handle
  from public.rounds r
  join public.episodes e on e.id = r.episode_id
  join public.creators c on c.id = e.creator_id
  where r.id = p_round
$$;

-- =====================================================================
-- Custom questions ("Write your own")
-- =====================================================================

create table public.custom_questions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  prompt text not null check (char_length(prompt) between 3 and 200),
  answer text not null check (char_length(answer) between 1 and 80),
  choices text[] not null default '{}' check (coalesce(array_length(choices, 1), 0) <= 4),
  created_at timestamptz not null default now()
);
alter table public.custom_questions enable row level security;
create policy "owner reads custom questions" on public.custom_questions for select to authenticated using (public.is_owner(creator_id));
create policy "owner writes custom questions" on public.custom_questions for insert to authenticated with check (public.is_owner(creator_id));
create policy "owner deletes custom questions" on public.custom_questions for delete to authenticated using (public.is_owner(creator_id));

-- =====================================================================
-- Push, SMS log, rate limits, deletion codes (service role only)
-- =====================================================================

create table public.push_subscriptions (
  endpoint text primary key,
  creator_id uuid not null references public.creators (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.sms_log (
  id uuid primary key default gen_random_uuid(),
  to_phone text not null,
  body text not null,
  provider text not null,
  status text not null,
  error text,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  key text primary key,
  hits int not null,
  window_start timestamptz not null
);

-- True when the call is allowed. Fixed window per key.
create or replace function public.hit_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_hits int;
begin
  insert into public.rate_limits as rl (key, hits, window_start) values (p_key, 1, now())
  on conflict (key) do update set
    hits = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1 else rl.hits + 1 end,
    window_start = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then now() else rl.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;

create table public.deletion_codes (
  receipt_code text primary key,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null
);

alter table public.fans enable row level security;
alter table public.fan_scores enable row level security;
alter table public.fan_responses enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.sms_log enable row level security;
alter table public.rate_limits enable row level security;
alter table public.deletion_codes enable row level security;

-- =====================================================================
-- KYC selfie storage (private bucket; written by the API only)
-- =====================================================================

do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('kyc', 'kyc', false) on conflict (id) do nothing;
  end if;
end $$;

-- =====================================================================
-- Grants
-- =====================================================================

revoke all on public.profiles, public.withdrawals, public.fans, public.fan_scores,
  public.fan_responses, public.live_prompt_secrets, public.push_subscriptions, public.sms_log,
  public.rate_limits, public.deletion_codes
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant insert (id, display_name) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.withdrawals to authenticated;
grant select, insert, update on public.live_prompt_secrets to authenticated;
revoke all on public.custom_questions from anon, authenticated;
grant select, insert, delete on public.custom_questions to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.random_code(int) to authenticated, service_role;
grant execute on function public.is_owner(uuid) to authenticated;
grant execute on function public.owns_episode(uuid) to authenticated;
grant execute on function public.wallet_balance(uuid) to authenticated, service_role;
grant execute on function public.wallet_summary(uuid) to authenticated, service_role;
grant execute on function public.resolve_prompt(uuid, int, text) to authenticated;
grant execute on function public.live_payout_statuses() to authenticated, service_role;

grant execute on function public.live_session(text) to anon, authenticated;
grant execute on function public.live_leaderboard(uuid, uuid, text, int) to anon, authenticated;
grant execute on function public.prompt_stats(uuid) to anon, authenticated;
grant execute on function public.public_receipt(text) to anon, authenticated;
grant execute on function public.public_episode(text) to anon, authenticated;
grant execute on function public.public_episode_payouts(text) to anon, authenticated;
grant execute on function public.public_round(uuid) to anon, authenticated;

grant execute on function public.create_payout(uuid, jsonb, boolean) to service_role;
grant execute on function public.mark_payout_result(uuid, text, text, text) to service_role;
grant execute on function public.claim_payout(text, text, text, text, text, text, text) to service_role;
grant execute on function public.release_expired_claims() to service_role;
grant execute on function public.record_topup(uuid, bigint, text) to service_role;
grant execute on function public.record_funding(uuid, bigint, text, text, uuid, text) to service_role;
grant execute on function public.create_withdrawal(uuid, bigint, bigint, uuid, boolean) to service_role;
grant execute on function public.mark_withdrawal_result(uuid, text, text, text) to service_role;
grant execute on function public.anonymize_payout(text) to service_role;
grant execute on function public.record_response(uuid, uuid, int, text, boolean, int, int) to service_role;
grant execute on function public.fan_rank(uuid, uuid) to service_role;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

alter publication supabase_realtime add table public.withdrawals;
