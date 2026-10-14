-- Demo data for NEXT_PUBLIC_DEMO_MODE=1 (loaded into the in-memory database
-- by src/lib/demo/db.ts after the migrations). Mirrors the screen designs:
-- Tobi's show: Ep 10–11 wrapped, Ep 12 Yaba Market live.
-- Money goes through the real functions, so the ledger always adds up.
-- Not for a real Supabase project: it writes auth.users directly.

create function pg_temp.at_lagos(days int, hh int, mm int) returns timestamptz language sql as $$
  select (date_trunc('day', now() at time zone 'Africa/Lagos') + make_interval(days => days, hours => hh, mins => mm)) at time zone 'Africa/Lagos'
$$;

do $seed$
declare
  tobi constant uuid := '00000000-0000-4000-8000-00000000000a';
  ep10 uuid; ep11 uuid; ep12 uuid;
  r uuid; p public.payouts; w public.withdrawals;
  i int; n int;
  names text[] := array['Chidi','Funke','Emeka','Aisha','Tunde','Ngozi','Bayo','Kelechi','Zainab','Segun','Amina','Uche','Yemi','Ifeoma','Musa','Bola','Chioma','Dapo','Halima','Obinna','Sade','Femi','Nneka','Kunle','Hauwa','Ikenna','Lola','Ade','Ebuka','Rukky','Tayo'];
  surnames text[] := array['OKAFOR','ADEBAYO','EZE','BELLO','OGUNDIPE','NWOSU','ADEYEMI','IBRAHIM','OKONKWO','ALABI'];
  fan uuid;
  fans uuid[] := '{}';
  vote uuid;
  plan jsonb := '{
    "money-ladder":     {"amount": 20000000, "rounds": 5, "top": 8000000, "unit": 500000},
    "spin-the-wheel":   {"amount": 12000000, "rounds": 6, "top": 5000000, "unit": 500000},
    "finish-the-lyric": {"amount": 10000000, "rounds": 8, "top": 3750000, "unit": 1250000},
    "name-the-song":    {"amount":  8000000, "rounds": 8, "top": 1500000, "unit": 1000000}
  }';
begin
  -- ---------------------------------------------------------------- people
  insert into auth.users (id, phone) values (tobi, '2348035550142');
  insert into public.profiles (id, display_name) values (tobi, 'Tobi Adeyemi');
  insert into public.creators (id, display_name, instagram_handle, kyc_status, phone,
      bvn_last4, bvn_name, return_bank_code, return_account_number, return_account_name,
      provider_customer_code, virtual_account_number, virtual_account_bank, virtual_account_name, plan)
  values (tobi, 'Tobi Streets', 'tobi.streets', 'verified', '2348035550142',
      '7781', 'TOBI ADEYEMI', '058', '0011223389', 'TOBI ADEYEMI',
      'MOCK_CUS_tobi', '9920441873', 'Moniepoint MFB', 'StreetPlay / Tobi Streets', 'pro');
  insert into public.custom_questions (creator_id, prompt, answer, choices) values
    (tobi, 'Which Lagos bus stop is famous for the song by Wizkid?', 'Ojuelegba', '{Ojuelegba,Obalende,Oshodi,Yaba}'),
    (tobi, 'How many legs does a spider have?', '8', '{6,8,10,12}'),
    (tobi, 'What colour is a Lagos danfo?', 'Yellow', '{Yellow,White,Blue,Green}');

  -- ---------------------------------------------------------------- Ep 10 (wrapped, leftover withdrawn)
  insert into public.episodes (creator_id, number, title, location, starts_at, status, formats, budget, max_payout, confirm_above, created_at)
  values (tobi, 10, 'Lekki Phase 1', 'Lekki, Lagos', pg_temp.at_lagos(-12, 14, 0), 'live', '{money-ladder,spin-the-wheel}', 20000000, 5000000, 4000000, pg_temp.at_lagos(-13, 10, 0))
  returning id into ep10;
  perform public.record_funding(tobi, 20000000, 'seed:ep10:topup', 'topup', ep10, 'TOBI ADEYEMI · GTBank');
  for i in 1..9 loop
    insert into public.rounds (episode_id, format, status, prize_cap, participant_name, started_at, ended_at, summary, created_at)
    values (ep10, case when i % 2 = 0 then 'spin-the-wheel' else 'money-ladder' end, 'won', 5000000, names[i + 10],
            pg_temp.at_lagos(-12, 14, i * 6), pg_temp.at_lagos(-12, 14, i * 6 + 3), case when i % 2 = 0 then '₦10K slice' else 'walked' end, pg_temp.at_lagos(-12, 14, i * 6))
    returning id into r;
    p := public.create_payout(tobi, jsonb_build_object('idempotency_key', 'seed:ep10:' || i, 'episode_id', ep10, 'round_id', r,
          'amount', case when i = 9 then 3600000 else 1000000 end, 'fee', 5000, 'account_number', lpad((1000000000 + i * 7919)::text, 10, '0'),
          'bank_code', '058', 'account_name', surnames[1 + i % 10] || ' ' || upper(names[i + 10]), 'recipient_display', names[i + 10] || ' ' || left(surnames[1 + i % 10], 1) || '.'), false);
    perform public.mark_payout_result(p.id, 'sent', 'SEED-' || i, null);
    update public.payouts set created_at = pg_temp.at_lagos(-12, 14, i * 6 + 3), sent_at = pg_temp.at_lagos(-12, 14, i * 6 + 3) where id = p.id;
  end loop;
  update public.episodes set status = 'wrapped', wrapped_at = pg_temp.at_lagos(-12, 18, 0) where id = ep10;
  w := public.create_withdrawal(tobi, 6400000, 5000, ep10, false);
  perform public.mark_withdrawal_result(w.id, 'sent', 'SEED-WD', null);
  update public.wallet_entries set created_at = pg_temp.at_lagos(-10, 9, 30) where reference = 'withdrawal:' || w.id;

  -- ---------------------------------------------------------------- Ep 11 Surulere (wrapped, 31 winners, ₦420,000)
  insert into public.episodes (creator_id, number, title, location, starts_at, status, formats, pack_ids, budget, max_payout, confirm_above, sponsor_name, created_at)
  values (tobi, 11, 'Surulere', 'Surulere, Lagos', pg_temp.at_lagos(-5, 15, 0), 'live', '{money-ladder,spin-the-wheel,quickfire-trivia}', '{naija-general,football}',
          45000000, 8000000, 9000000, 'Zobo Republic', pg_temp.at_lagos(-7, 10, 0))
  returning id into ep11;
  perform public.record_funding(tobi, 25000000, 'seed:ep11:sponsor', 'sponsor', ep11, 'Zobo Republic');
  perform public.record_funding(tobi, 30000000, 'seed:ep11:topup', 'topup', ep11, 'TOBI ADEYEMI · GTBank');
  update public.wallet_entries set created_at = pg_temp.at_lagos(-6, 12, 0) where reference = 'seed:ep11:sponsor';
  update public.wallet_entries set created_at = pg_temp.at_lagos(-7, 11, 0) where reference = 'seed:ep11:topup';
  for i in 1..31 loop
    insert into public.rounds (episode_id, format, status, prize_cap, participant_name, started_at, ended_at, summary, result, created_at)
    values (ep11, (array['money-ladder','spin-the-wheel','quickfire-trivia'])[1 + i % 3], 'won', 8000000, names[i],
            pg_temp.at_lagos(-5, 15, i * 5), pg_temp.at_lagos(-5, 15, i * 5 + 3), (array['walked','₦10K slice','3 right'])[1 + i % 3], '{}', pg_temp.at_lagos(-5, 15, i * 5))
    returning id into r;
    insert into public.consents (round_id, name_given, release_version, agreed_at) values (r, names[i], '2026-10-v1', pg_temp.at_lagos(-5, 15, i * 5));
    p := public.create_payout(tobi, jsonb_build_object('idempotency_key', 'seed:ep11:' || i, 'episode_id', ep11, 'round_id', r,
          'amount', case i when 1 then 2000000 when 2 then 8000000 when 3 then 5000000 else 1000000 end, 'fee', 5000,
          'account_number', lpad((2000000000 + i * 104729)::text, 10, '0'), 'bank_code', (array['058','999992','044','50515','50211'])[1 + i % 5],
          'account_name', surnames[1 + i % 10] || ' ' || upper(names[i]), 'recipient_display', names[i] || ' ' || left(surnames[1 + i % 10], 1) || '.'), false);
    perform public.mark_payout_result(p.id, 'sent', 'SEED-11-' || i, null);
    update public.payouts set created_at = pg_temp.at_lagos(-5, 15, i * 5 + 3), sent_at = pg_temp.at_lagos(-5, 15, i * 5 + 3) where id = p.id;
    update public.wallet_entries set created_at = pg_temp.at_lagos(-5, 15, i * 5 + 3) where payout_id = p.id;
  end loop;
  update public.episodes set status = 'wrapped', wrapped_at = pg_temp.at_lagos(-5, 19, 0) where id = ep11;

  -- ---------------------------------------------------------------- Ep 12 Yaba Market (live today)
  insert into public.episodes (creator_id, number, title, location, starts_at, status, formats, pack_ids, format_plan, budget,
      max_payout, confirm_above, repeat_policy, sponsor_name, public_code, live_code, created_at, live_state)
  values (tobi, 12, 'Yaba Market', 'Yaba, Lagos', pg_temp.at_lagos(0, 15, 0), 'live',
      '{finish-the-lyric,name-the-song,money-ladder,spin-the-wheel}', '{naija-general,lagos-streets,afrobeats-classics,2000s-naija}',
      plan, 50000000, 8000000, 5000000, 'flag', 'Zobo Republic', 'EPYABA', 'YABAXX', pg_temp.at_lagos(0, 11, 10),
      jsonb_build_object('round', 10, 'format', 'money-ladder', 'starts_at', now() + interval '24 seconds', 'note', 'Tobi is walking up to the next stranger.'))
  returning id into ep12;
  update public.creators set default_episode_id = ep12 where id = tobi;
  perform public.record_funding(tobi, 22760000, 'seed:float', 'topup', null, 'TOBI ADEYEMI · GTBank');
  update public.wallet_entries set created_at = pg_temp.at_lagos(-2, 18, 20) where reference = 'seed:float';
  perform public.record_funding(tobi, 50000000, 'seed:ep12:topup', 'topup', ep12, 'TOBI ADEYEMI · GTBank');
  update public.wallet_entries set created_at = now() - interval '2 minutes' where reference = 'seed:ep12:topup';

  -- Rounds R1–R9 as in the episode log design, each with consent.
  declare
    rows_ jsonb := '[
      {"n":"Musa","acct":"0812345671","bank":"999992","name":"MUSA IBRAHIM","fmt":"spin-the-wheel","sum":"₦10K slice","amt":1000000,"t":"14:42","st":"won"},
      {"n":"Kola","acct":null,"bank":null,"name":null,"fmt":"money-ladder","sum":"Missed","amt":0,"t":"14:50","st":"lost"},
      {"n":"Bola","acct":"0823456782","bank":"044","name":"TAIWO BOLA","fmt":"finish-the-lyric","sum":"1 line","amt":1250000,"t":"14:57","st":"won"},
      {"n":"Uche","acct":"0834567893","bank":"058","name":"OBI UCHE","fmt":"spin-the-wheel","sum":"₦50K slice","amt":5000000,"t":"15:05","st":"won"},
      {"n":"Halima","acct":"0845678904","bank":"50515","name":"MUSA HALIMA","fmt":"money-ladder","sum":"walked","amt":1000000,"t":"15:14","st":"walked-away"},
      {"n":"Seyi","acct":"0856789015","bank":"999992","name":"BALOGUN SEYI","fmt":"name-the-song","sum":"Title + artist","amt":1500000,"t":"15:22","st":"won"},
      {"n":"Ngozi","acct":null,"bank":null,"name":null,"fmt":"spin-the-wheel","sum":"Dare","amt":0,"t":"15:31","st":"lost"},
      {"n":"Femi","acct":"0867890126","bank":"058","name":"KOLAWOLE FEMI","fmt":"finish-the-lyric","sum":"2 lines","amt":2500000,"t":"15:40","st":"won"},
      {"n":"Adaeze","acct":"0123456789","bank":"058","name":"ADAEZE N. OKORO","fmt":"money-ladder","sum":"walked","amt":2000000,"t":"15:47","st":"walked-away"}
    ]';
    x jsonb;
    seed_ text;
    t timestamptz;
  begin
    for i in 0..jsonb_array_length(rows_) - 1 loop
      x := rows_ -> i;
      t := pg_temp.at_lagos(0, split_part(x ->> 't', ':', 1)::int, split_part(x ->> 't', ':', 2)::int);
      seed_ := encode(extensions.digest('demo-seed-' || i, 'sha256'), 'hex');
      insert into public.rounds (episode_id, format, status, prize_cap, prize_won, participant_name, commitment, seed, started_at, ended_at, summary, result, created_at)
      values (ep12, x ->> 'fmt', x ->> 'st', 8000000, (x ->> 'amt')::bigint, x ->> 'n',
              encode(extensions.digest(seed_, 'sha256'), 'hex'), seed_, t - interval '4 minutes', t, x ->> 'sum', '{}', t - interval '4 minutes')
      returning id into r;
      insert into public.consents (round_id, name_given, release_version, agreed_at) values (r, x ->> 'n', '2026-10-v1', t - interval '5 minutes');
      if (x ->> 'amt')::bigint > 0 then
        p := public.create_payout(tobi, jsonb_build_object('idempotency_key', 'seed:ep12:' || i, 'episode_id', ep12, 'round_id', r,
              'amount', (x ->> 'amt')::bigint, 'fee', 5000, 'account_number', x ->> 'acct', 'bank_code', x ->> 'bank',
              'account_name', x ->> 'name', 'recipient_display', (x ->> 'n') || ' ' || left(regexp_replace(x ->> 'name', '^' || upper(x ->> 'n') || ' ?', ''), 1) || '.',
              'recipient_phone', case when x ->> 'n' = 'Adaeze' then '2348021114410' end), false);
        perform public.mark_payout_result(p.id, 'sent', 'SEED-12-' || i, null);
        update public.payouts set created_at = t, sent_at = t + interval '12 seconds' where id = p.id;
        update public.wallet_entries set created_at = t where payout_id = p.id;
        if x ->> 'n' = 'Adaeze' then update public.payouts set receipt_code = '7Q4K2R', recipient_display = 'Adaeze O.' where id = p.id; end if;
        if x ->> 'n' = 'Uche' then update public.payouts set receipt_code = '2H7D9K' where id = p.id; end if;
      end if;
      -- 2–3 clip marks per round
      insert into public.clip_markers (episode_id, round_id, label, at)
      select ep12, r, (array['funny','big-win','reaction'])[1 + (g + i) % 3], t - make_interval(mins => g)
      from generate_series(1, 2 + i % 2) g;
    end loop;
  end;

  -- R10: Chinedu, ₦80,000 top rung (held to send: above the ₦50,000 confirm limit).
  insert into public.rounds (episode_id, format, status, prize_cap, prize_won, participant_name, started_at, ended_at, summary, created_at)
  values (ep12, 'money-ladder', 'won', 8000000, 8000000, 'Chinedu', now() - interval '9 minutes', now() - interval '3 minutes', 'top rung', now() - interval '9 minutes')
  returning id into r;
  insert into public.consents (round_id, name_given, release_version, agreed_at) values (r, 'Chinedu', '2026-10-v1', now() - interval '10 minutes');
  p := public.create_payout(tobi, jsonb_build_object('idempotency_key', 'seed:ep12:chinedu', 'episode_id', ep12, 'round_id', r, 'amount', 8000000, 'fee', 5000,
        'account_number', '0458112212', 'bank_code', '044', 'account_name', 'CHINEDU P. EZE', 'recipient_display', 'Chinedu E.'), false);
  perform public.mark_payout_result(p.id, 'sent', 'SEED-12-chinedu', null);
  update public.payouts set sent_at = now() - interval '3 minutes', created_at = now() - interval '3 minutes', receipt_code = '3X6L8D' where id = p.id;

  -- R11: Bisi, ₦15,000 to Kuda — still sending (host's network dropped).
  insert into public.rounds (episode_id, format, status, prize_cap, prize_won, participant_name, started_at, ended_at, summary, created_at)
  values (ep12, 'spin-the-wheel', 'won', 5000000, 1500000, 'Bisi', now() - interval '8 minutes', now() - interval '6 minutes', '₦15K slice', now() - interval '8 minutes')
  returning id into r;
  insert into public.consents (round_id, name_given, release_version, agreed_at) values (r, 'Bisi', '2026-10-v1', now() - interval '8 minutes');
  p := public.create_payout(tobi, jsonb_build_object('idempotency_key', 'seed:ep12:bisi', 'episode_id', ep12, 'round_id', r, 'amount', 1500000, 'fee', 5000,
        'account_number', '2011223344', 'bank_code', '50211', 'account_name', 'BISI ADEBAYO', 'recipient_display', 'Bisi A.', 'recipient_phone', '2348022214410'), false);
  update public.payouts set receipt_code = '3B8NQR' where id = p.id;

  -- R12: Mama Sade, no bank account — ₦10,000 held, claim code 482913.
  insert into public.rounds (episode_id, format, status, prize_cap, prize_won, participant_name, started_at, ended_at, summary, created_at)
  values (ep12, 'spin-the-wheel', 'won', 5000000, 1000000, 'Mama Sade', now() - interval '5 minutes', now() - interval '4 minutes', '₦10K slice', now() - interval '5 minutes')
  returning id into r;
  insert into public.consents (round_id, name_given, release_version, agreed_at) values (r, 'Mama Sade', '2026-10-v1', now() - interval '5 minutes');
  p := public.create_payout(tobi, jsonb_build_object('idempotency_key', 'seed:ep12:sade', 'episode_id', ep12, 'round_id', r, 'amount', 1000000, 'fee', 5000,
        'hold', true, 'claim_code', '482913', 'claim_hours', 168, 'recipient_phone', '2348062219034', 'recipient_display', 'Mama S.'), false);

  -- R13: Amaka just won ₦15,000 — her QR link (/p/K7Q2AB) is waiting for her account.
  insert into public.rounds (episode_id, format, status, prize_cap, prize_won, participant_name, started_at, ended_at, summary, created_at)
  values (ep12, 'finish-the-lyric', 'won', 3750000, 1250000, 'Amaka', now() - interval '2 minutes', now() - interval '1 minute', '1 line', now() - interval '2 minutes')
  returning id into r;
  insert into public.consents (round_id, name_given, release_version, agreed_at) values (r, 'Amaka', '2026-10-v1', now() - interval '2 minutes');
  insert into public.account_requests (episode_id, round_id, amount, participant_name, code, expires_at)
  values (ep12, r, 1250000, 'Amaka', 'K7Q2AB', now() + interval '1 day');

  -- ---------------------------------------------------------------- viewers
  declare
    handles text[] := array['chioma.xo','bayo_bayo','tunde_k','ife.ade','mr_kunle','zainab.ng','emeka_x','lolabee'];
    pts int[] := array[720, 655, 590, 560, 515, 470, 430, 395];
    streaks int[] := array[4, 3, 3, 3, 2, 2, 1, 1];
  begin
    for i in 1..array_length(handles, 1) loop
      insert into public.fans (creator_id, display_name, token_hash) values (tobi, handles[i], md5('seed-fan-' || i)) returning id into fan;
      fans := fans || fan;
      insert into public.fan_scores (episode_id, fan_id, points, streak, best_streak, correct, answered)
      values (ep12, fan, pts[i], streaks[i], streaks[i], 6 + (8 - i) / 2, 14);
      insert into public.fan_scores (episode_id, fan_id, points, best_streak, correct, answered) values (ep11, fan, pts[i] / 2, 2, 5, 12);
    end loop;
    for i in 1..42 loop
      insert into public.fans (creator_id, display_name, token_hash) values (tobi, 'viewer_' || (100 + i * 37), md5('seed-viewer-' || i)) returning id into fan;
      fans := fans || fan;
      insert into public.fan_scores (episode_id, fan_id, points, correct, answered) values (ep12, fan, (i * 53) % 380, i % 7, 10);
    end loop;
  end;

  -- tunde_k placed #3: a ₦5,000 viewer prize to claim at /win/TUNDE9M2.
  p := public.create_payout(tobi, jsonb_build_object('idempotency_key', 'seed:viewer-prize:tunde', 'episode_id', ep12, 'amount', 500000, 'fee', 5000,
        'kind', 'viewer', 'hold', true, 'claim_code', 'TUNDE9M2', 'claim_hours', 24, 'fan_id', fans[3], 'recipient_display', 'tunde_k'), false);

  -- An open vote right now: "Comot or carry go?" (72% go again).
  insert into public.live_prompts (episode_id, kind, label, round_number, question, options, duration_seconds, closes_at)
  values (ep12, 'vote', 'Round 10 · Vote', 10, 'She''s on ₦20,000. Comot or carry go?', '{Walk away,Go again}', 600, now() + interval '10 minutes')
  returning id into vote;
  for i in 2..array_length(fans, 1) loop
    insert into public.fan_responses (prompt_id, fan_id, option, points) values (vote, fans[i], case when i % 25 < 7 then 0 else 1 end, 10);
  end loop;
end
$seed$;
