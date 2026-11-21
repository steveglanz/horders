-- A Delver's Keys board per season (docs/design/keys.md, "For engineering: a
-- board per season"). Each season starts a fresh board; keys themselves never
-- reset. Every row written so far belongs to season id 0 (Season 1, which
-- began on week 2968; seasonOf in sim/content/season.ts).
--
-- Compatible with the client already live: submit_key keeps its signature (the
-- client's week is now ignored), and top_keys still answers (p_dungeon, p_limit).

alter table public.key_bests add column season int not null default 0;
alter table public.key_bests drop constraint key_bests_pkey;
alter table public.key_bests add primary key (user_id, dungeon, season);
drop index if exists public.key_bests_rank;
create index key_bests_rank on public.key_bests (dungeon, season, level desc, seconds asc, updated_at asc);

-- Weeks since 1 Jan 1970 (weekOf in sim/content/omens.ts), then 6-week seasons from week 2968.
create or replace function public.key_season_now()
returns int
language sql stable set search_path = ''
as $$
  select floor((floor(extract(epoch from now()) / 604800) - 2968) / 6)::int;
$$;

create or replace function public.key_rank(p_user uuid, p_dungeon text, p_season int)
returns int
language sql stable security definer set search_path = ''
as $$
  select r from (
    select user_id, rank() over (order by level desc, seconds asc, updated_at asc)::int as r
      from public.key_bests where dungeon = p_dungeon and season = p_season
  ) t where user_id = p_user;
$$;

create or replace function public.submit_key(
  p_dungeon text, p_cls text, p_level int, p_seconds int, p_week int default 0, p_name text default 'A hero'
)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  uid    uuid := auth.uid();
  wk     int  := floor(extract(epoch from now()) / 604800)::int;
  ssn    int  := public.key_season_now();
  prev   public.key_bests;
  ever   int;
  last   timestamptz;
  lvl    int;
  nm     text;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  if p_dungeon !~ '^[a-z]{2,24}$' or p_cls not in ('emberwright', 'duskblade', 'bulwark', 'lumen', 'slagbinder') then
    return json_build_object('ok', false, 'reason', 'bad_input');
  end if;
  if coalesce(p_seconds, 0) < 60 or p_seconds > 3600 or coalesce(p_level, 0) < 1 then
    return json_build_object('ok', false, 'reason', 'bad_input');
  end if;
  nm := left(btrim(regexp_replace(coalesce(p_name, ''), '[^[:alnum:] ''.-]', '', 'g')), 40);
  if nm = '' then nm := 'A hero'; end if;

  -- Lock every season's row for this player and dungeon, so the wait and the clamp see them all.
  perform 1 from public.key_bests where user_id = uid and dungeon = p_dungeon for update;
  select max(level), max(updated_at) into ever, last
    from public.key_bests where user_id = uid and dungeon = p_dungeon;
  -- The 60 s wait holds across seasons.
  if last is not null and last > now() - interval '60 seconds' then
    return json_build_object('ok', false, 'reason', 'too_soon');
  end if;
  -- A key rises by at most 2 per run, measured against the best in any season.
  lvl := least(p_level, coalesce(ever, 0) + 2, 99);

  select * into prev from public.key_bests where user_id = uid and dungeon = p_dungeon and season = ssn;
  if not found then
    insert into public.key_bests (user_id, dungeon, season, cls, name, level, seconds, week)
    values (uid, p_dungeon, ssn, p_cls, nm, lvl, p_seconds, wk);
  elsif lvl > prev.level or (lvl = prev.level and p_seconds < prev.seconds) then
    update public.key_bests
       set cls = p_cls, name = nm, level = lvl, seconds = p_seconds, week = wk,
           runs = prev.runs + 1, updated_at = now()
     where user_id = uid and dungeon = p_dungeon and season = ssn;
  else
    update public.key_bests set runs = prev.runs + 1, updated_at = now()
     where user_id = uid and dungeon = p_dungeon and season = ssn;
    return json_build_object('ok', true, 'best', false, 'level', prev.level, 'seconds', prev.seconds,
      'season', ssn, 'rank', public.key_rank(uid, p_dungeon, ssn));
  end if;
  return json_build_object('ok', true, 'best', true, 'level', lvl, 'seconds', p_seconds, 'clamped', lvl < p_level,
    'season', ssn, 'rank', public.key_rank(uid, p_dungeon, ssn));
end;
$$;

-- The top N for a dungeon in a season (the current one by default), plus the caller's own row.
drop function if exists public.top_keys(text, int);
create or replace function public.top_keys(p_dungeon text, p_limit int default 10, p_season int default null)
returns json
language plpgsql stable security definer set search_path = ''
as $$
declare
  ssn  int := coalesce(p_season, public.key_season_now());
  top  json;
  mine json;
begin
  select coalesce(json_agg(row_to_json(t)), '[]'::json) into top from (
    select rank() over (order by level desc, seconds asc, updated_at asc)::int as rank,
           name, cls, level, seconds
      from public.key_bests where dungeon = p_dungeon and season = ssn
     order by level desc, seconds asc, updated_at asc
     limit greatest(1, least(coalesce(p_limit, 10), 50))
  ) t;
  if auth.uid() is not null then
    select json_build_object('rank', public.key_rank(auth.uid(), p_dungeon, ssn), 'name', name, 'cls', cls,
                             'level', level, 'seconds', seconds)
      into mine from public.key_bests where user_id = auth.uid() and dungeon = p_dungeon and season = ssn;
  end if;
  return json_build_object('dungeon', p_dungeon, 'season', ssn, 'top', top, 'me', mine);
end;
$$;

drop function if exists public.key_rank(uuid, text);
revoke all on function public.key_rank(uuid, text, int) from public, anon, authenticated;
revoke all on function public.key_season_now() from public, anon, authenticated;
revoke all on function public.submit_key(text, text, int, int, int, text) from public, anon;
grant execute on function public.submit_key(text, text, int, int, int, text) to authenticated;
revoke all on function public.top_keys(text, int, int) from public;
grant execute on function public.top_keys(text, int, int) to anon, authenticated;
