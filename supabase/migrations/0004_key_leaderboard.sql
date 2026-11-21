-- Delver's Keys leaderboard (P3, docs/design/keys.md). One row per player per
-- solo dungeon: their best beaten key level and the time it took. Players can't
-- write the table directly; submit_key clamps what a run could plausibly claim.
-- Ranking: higher level first, then the faster time, then whoever got there first.

create table public.key_bests (
  user_id    uuid not null references auth.users (id) on delete cascade,
  dungeon    text not null check (dungeon ~ '^[a-z]{2,24}$'),
  cls        text not null check (cls in ('emberwright', 'duskblade', 'bulwark', 'lumen')),
  name       text not null default 'A hero',
  level      int  not null check (level between 1 and 99),
  seconds    int  not null check (seconds between 60 and 3600),
  week       int  not null default 0,
  runs       int  not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, dungeon)
);
create index key_bests_rank on public.key_bests (dungeon, level desc, seconds asc, updated_at asc);

alter table public.key_bests enable row level security;
-- No policies: reads and writes go through the functions below only.

create or replace function public.submit_key(
  p_dungeon text, p_cls text, p_level int, p_seconds int, p_week int default 0, p_name text default 'A hero'
)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  uid  uuid := auth.uid();
  prev public.key_bests;
  lvl  int;
  nm   text;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  if p_dungeon !~ '^[a-z]{2,24}$' or p_cls not in ('emberwright', 'duskblade', 'bulwark', 'lumen') then
    return json_build_object('ok', false, 'reason', 'bad_input');
  end if;
  -- A delve can't be cleared in under a minute, and a key run that took over an hour isn't a record.
  if coalesce(p_seconds, 0) < 60 or p_seconds > 3600 or coalesce(p_level, 0) < 1 then
    return json_build_object('ok', false, 'reason', 'bad_input');
  end if;
  -- Names come from players: letters, digits, spaces and ' . - only.
  nm := left(btrim(regexp_replace(coalesce(p_name, ''), '[^[:alnum:] ''.-]', '', 'g')), 40);
  if nm = '' then nm := 'A hero'; end if;

  select * into prev from public.key_bests where user_id = uid and dungeon = p_dungeon for update;
  if found and prev.updated_at > now() - interval '60 seconds' then
    return json_build_object('ok', false, 'reason', 'too_soon');
  end if;
  -- A key rises by at most 2 per run (a fast win), so a record can climb at most 2 past the last one.
  lvl := least(p_level, coalesce(prev.level, 0) + 2, 99);

  if not found then
    insert into public.key_bests (user_id, dungeon, cls, name, level, seconds, week)
    values (uid, p_dungeon, p_cls, nm, lvl, p_seconds, coalesce(p_week, 0));
  elsif lvl > prev.level or (lvl = prev.level and p_seconds < prev.seconds) then
    update public.key_bests
       set cls = p_cls, name = nm, level = lvl, seconds = p_seconds, week = coalesce(p_week, 0),
           runs = prev.runs + 1, updated_at = now()
     where user_id = uid and dungeon = p_dungeon;
  else
    -- Not a new best: count the run and start the 60 s wait, keep the record.
    update public.key_bests set runs = prev.runs + 1, updated_at = now()
     where user_id = uid and dungeon = p_dungeon;
    return json_build_object('ok', true, 'best', false, 'level', prev.level, 'seconds', prev.seconds,
      'rank', public.key_rank(uid, p_dungeon));
  end if;
  return json_build_object('ok', true, 'best', true, 'level', lvl, 'seconds', p_seconds, 'clamped', lvl < p_level,
    'rank', public.key_rank(uid, p_dungeon));
end;
$$;

create or replace function public.key_rank(p_user uuid, p_dungeon text)
returns int
language sql stable security definer set search_path = ''
as $$
  select r from (
    select user_id, rank() over (order by level desc, seconds asc, updated_at asc)::int as r
      from public.key_bests where dungeon = p_dungeon
  ) t where user_id = p_user;
$$;

-- The top N for a dungeon, plus the caller's own row and rank when they have one.
create or replace function public.top_keys(p_dungeon text, p_limit int default 10)
returns json
language plpgsql stable security definer set search_path = ''
as $$
declare
  top  json;
  mine json;
begin
  select coalesce(json_agg(row_to_json(t)), '[]'::json) into top from (
    select rank() over (order by level desc, seconds asc, updated_at asc)::int as rank,
           name, cls, level, seconds
      from public.key_bests where dungeon = p_dungeon
     order by level desc, seconds asc, updated_at asc
     limit greatest(1, least(coalesce(p_limit, 10), 50))
  ) t;
  if auth.uid() is not null then
    select json_build_object('rank', public.key_rank(auth.uid(), p_dungeon), 'name', name, 'cls', cls,
                             'level', level, 'seconds', seconds)
      into mine from public.key_bests where user_id = auth.uid() and dungeon = p_dungeon;
  end if;
  return json_build_object('dungeon', p_dungeon, 'top', top, 'me', mine);
end;
$$;

revoke all on function public.submit_key(text, text, int, int, int, text) from public, anon;
grant execute on function public.submit_key(text, text, int, int, int, text) to authenticated;
revoke all on function public.key_rank(uuid, text) from public, anon, authenticated;
grant execute on function public.top_keys(text, int) to anon, authenticated;
