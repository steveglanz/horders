-- Daily bounty leaderboard (roadmap R7: "a daily leaderboard by clear time").
-- Everyone gets the same bounty on a given UTC day; only the tier is the
-- hero's own, and the tier fixes the dungeon too (bountyFor in
-- sim/content/bounty.ts), so a board is one day at one tier. Fastest clear
-- first. Players can't write the table; submit_bounty checks what it can.

create table public.bounty_bests (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        int  not null,
  tier       int  not null check (tier between 1 and 99),
  dungeon    text not null check (dungeon ~ '^[a-z]{2,24}$'),
  cls        text not null check (cls in ('emberwright', 'duskblade', 'bulwark', 'lumen', 'slagbinder')),
  name       text not null default 'A hero',
  seconds    int  not null check (seconds between 40 and 1800),
  runs       int  not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, day, tier)
);
create index bounty_bests_rank on public.bounty_bests (day, tier, seconds asc, updated_at asc);

alter table public.bounty_bests enable row level security;
-- No policies: reads and writes go through the functions below only.

-- Days since 1 Jan 1970, UTC (dayOf in sim/content/bounty.ts).
create or replace function public.bounty_day_now()
returns int
language sql stable set search_path = ''
as $$
  select floor(extract(epoch from now()) / 86400)::int;
$$;

create or replace function public.bounty_rank(p_user uuid, p_day int, p_tier int)
returns int
language sql stable security definer set search_path = ''
as $$
  select r from (
    select user_id, rank() over (order by seconds asc, updated_at asc)::int as r
      from public.bounty_bests where day = p_day and tier = p_tier
  ) t where user_id = p_user;
$$;

create or replace function public.submit_bounty(
  p_day int, p_tier int, p_dungeon text, p_cls text, p_seconds int, p_name text default 'A hero'
)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  uid   uuid := auth.uid();
  today int  := public.bounty_day_now();
  prev  public.bounty_bests;
  last  timestamptz;
  nm    text;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  -- Today's bounty only. A run begun just before midnight UTC may land in the first 30 minutes of the next day.
  if p_day is null or not (p_day = today or (p_day = today - 1 and now() < (today::bigint * 86400 + 1800) * interval '1 second' + timestamptz 'epoch')) then
    return json_build_object('ok', false, 'reason', 'wrong_day');
  end if;
  if p_dungeon !~ '^[a-z]{2,24}$' or p_cls not in ('emberwright', 'duskblade', 'bulwark', 'lumen', 'slagbinder')
     or coalesce(p_tier, 0) < 1 or p_tier > 99 then
    return json_build_object('ok', false, 'reason', 'bad_input');
  end if;
  -- Three fights can't be cleared in under 40 s (the balance tool's fastest win is about 100 s), and over 30 minutes isn't a record.
  if coalesce(p_seconds, 0) < 40 or p_seconds > 1800 then
    return json_build_object('ok', false, 'reason', 'bad_input');
  end if;
  nm := left(btrim(regexp_replace(coalesce(p_name, ''), '[^[:alnum:] ''.-]', '', 'g')), 40);
  if nm = '' then nm := 'A hero'; end if;

  perform 1 from public.bounty_bests where user_id = uid for update;
  select max(updated_at) into last from public.bounty_bests where user_id = uid;
  if last is not null and last > now() - interval '60 seconds' then
    return json_build_object('ok', false, 'reason', 'too_soon');
  end if;

  select * into prev from public.bounty_bests where user_id = uid and day = p_day and tier = p_tier;
  if not found then
    insert into public.bounty_bests (user_id, day, tier, dungeon, cls, name, seconds)
    values (uid, p_day, p_tier, p_dungeon, p_cls, nm, p_seconds);
  elsif p_seconds < prev.seconds then
    update public.bounty_bests
       set dungeon = p_dungeon, cls = p_cls, name = nm, seconds = p_seconds, runs = prev.runs + 1, updated_at = now()
     where user_id = uid and day = p_day and tier = p_tier;
  else
    update public.bounty_bests set runs = prev.runs + 1, updated_at = now()
     where user_id = uid and day = p_day and tier = p_tier;
    return json_build_object('ok', true, 'best', false, 'seconds', prev.seconds,
      'rank', public.bounty_rank(uid, p_day, p_tier));
  end if;
  return json_build_object('ok', true, 'best', true, 'seconds', p_seconds,
    'rank', public.bounty_rank(uid, p_day, p_tier));
end;
$$;

-- The fastest N for a day and tier (today by default), plus the caller's own row and rank.
create or replace function public.top_bounty(p_tier int, p_limit int default 5, p_day int default null)
returns json
language plpgsql stable security definer set search_path = ''
as $$
declare
  d    int := coalesce(p_day, public.bounty_day_now());
  top  json;
  mine json;
begin
  select coalesce(json_agg(row_to_json(t)), '[]'::json) into top from (
    select rank() over (order by seconds asc, updated_at asc)::int as rank, name, cls, seconds
      from public.bounty_bests where day = d and tier = p_tier
     order by seconds asc, updated_at asc
     limit greatest(1, least(coalesce(p_limit, 5), 50))
  ) t;
  if auth.uid() is not null then
    select json_build_object('rank', public.bounty_rank(auth.uid(), d, p_tier), 'name', name, 'cls', cls, 'seconds', seconds)
      into mine from public.bounty_bests where user_id = auth.uid() and day = d and tier = p_tier;
  end if;
  return json_build_object('day', d, 'tier', p_tier, 'top', top, 'me', mine);
end;
$$;

revoke all on function public.bounty_day_now() from public, anon, authenticated;
revoke all on function public.bounty_rank(uuid, int, int) from public, anon, authenticated;
revoke all on function public.submit_bounty(int, int, text, text, int, text) from public, anon;
grant execute on function public.submit_bounty(int, int, text, text, int, text) to authenticated;
revoke all on function public.top_bounty(int, int, int) from public;
grant execute on function public.top_bounty(int, int, int) to anon, authenticated;
