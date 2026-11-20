-- Horders backend v1: cloud hero saves and a shared world boss.
-- Players sign in anonymously (Supabase anonymous sign-ins), so auth.uid() is
-- a stable per-device player id that can later be linked to an email login.
-- The browser only ever holds the publishable key. Every table has RLS on,
-- and the world boss can only be changed through the functions below.

-- ---------------------------------------------------------------- saves
create table public.hero_saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  hero       jsonb not null,
  updated_at timestamptz not null default now(),
  constraint hero_saves_size check (pg_column_size(hero) < 262144)
);
alter table public.hero_saves enable row level security;

create policy "players read their own save" on public.hero_saves
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "players create their own save" on public.hero_saves
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "players update their own save" on public.hero_saves
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.hero_saves from anon, authenticated;
grant select, insert, update on public.hero_saves to authenticated;

-- ----------------------------------------------------------- world boss
create table public.world_bosses (
  id          bigint generated always as identity primary key,
  name        text not null,
  title       text not null,
  max_hp      bigint not null check (max_hp > 0),
  hp          bigint not null check (hp >= 0),
  started_at  timestamptz not null default now(),
  defeated_at timestamptz
);
-- At most one living boss at a time.
create unique index world_bosses_one_alive on public.world_bosses ((true)) where defeated_at is null;

create table public.boss_strikes (
  boss_id     bigint not null references public.world_bosses (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  damage      bigint not null default 0,
  runs        int not null default 0,
  last_hit_at timestamptz not null default now(),
  claimed     boolean not null default false,
  primary key (boss_id, user_id)
);
create index boss_strikes_user on public.boss_strikes (user_id);

alter table public.world_bosses enable row level security;
alter table public.boss_strikes enable row level security;

create policy "anyone can see the world bosses" on public.world_bosses
  for select to anon, authenticated using (true);
create policy "players see their own strikes" on public.boss_strikes
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.world_bosses from anon, authenticated;
revoke all on public.boss_strikes from anon, authenticated;
grant select on public.world_bosses to anon, authenticated;
grant select on public.boss_strikes to authenticated;

-- Spawns the next boss. Health grows with how many players fought the last one.
create function public.spawn_world_boss()
returns public.world_bosses
language plpgsql security definer set search_path = ''
as $$
declare
  names  text[] := array['Grandmother Slag', 'The Cinder Colossus', 'Old Ashmaw', 'The Furnace Regent'];
  titles text[] := array['Mother of Kilns', 'Walking Forge', 'Eater of Embers', 'Lord of the Deep Bellows'];
  n      int;
  last_fighters int;
  hp     bigint;
  b      public.world_bosses;
begin
  select count(*) into n from public.world_bosses;
  select count(*) into last_fighters from public.boss_strikes
   where boss_id = (select max(id) from public.world_bosses);
  hp := greatest(500000, 250000::bigint * last_fighters);
  insert into public.world_bosses (name, title, max_hp, hp)
  values (names[1 + n % array_length(names, 1)], titles[1 + n % array_length(titles, 1)], hp, hp)
  returning * into b;
  return b;
end;
$$;

-- Current boss, how many players are on it, and the caller's own share.
create function public.world_boss_status()
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  b public.world_bosses;
  fighters int;
  mine bigint := 0;
  unclaimed json;
begin
  select * into b from public.world_bosses where defeated_at is null order by id desc limit 1;
  if not found then
    b := public.spawn_world_boss();
  end if;
  select count(*) into fighters from public.boss_strikes where boss_id = b.id;
  if auth.uid() is not null then
    select coalesce(damage, 0) into mine from public.boss_strikes where boss_id = b.id and user_id = auth.uid();
    select coalesce(json_agg(json_build_object('boss_id', s.boss_id, 'name', w.name, 'damage', s.damage, 'max_hp', w.max_hp)), '[]'::json)
      into unclaimed
      from public.boss_strikes s join public.world_bosses w on w.id = s.boss_id
     where s.user_id = auth.uid() and w.defeated_at is not null and not s.claimed;
  end if;
  return json_build_object(
    'id', b.id, 'name', b.name, 'title', b.title, 'hp', b.hp, 'max_hp', b.max_hp,
    'started_at', b.started_at, 'fighters', fighters, 'my_damage', coalesce(mine, 0),
    'unclaimed', coalesce(unclaimed, '[]'::json));
end;
$$;

-- Adds one finished run's damage to the living boss. The server clamps what a
-- run can claim (per second of play and per run) and allows one strike a minute.
create function public.strike_world_boss(p_damage bigint, p_seconds int)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  uid  uuid := auth.uid();
  b    public.world_bosses;
  dmg  bigint;
  last timestamptz;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  dmg := greatest(0, least(coalesce(p_damage, 0), greatest(0, coalesce(p_seconds, 0)) * 400::bigint, 60000));

  select * into b from public.world_bosses where defeated_at is null order by id desc limit 1 for update;
  if not found then
    b := public.spawn_world_boss();
  end if;

  select last_hit_at into last from public.boss_strikes where boss_id = b.id and user_id = uid;
  if last is not null and last > now() - interval '60 seconds' then
    return json_build_object('ok', false, 'reason', 'too_soon', 'id', b.id, 'hp', b.hp, 'max_hp', b.max_hp);
  end if;

  update public.world_bosses
     set hp = greatest(0, hp - dmg),
         defeated_at = case when hp - dmg <= 0 then now() end
   where id = b.id
  returning * into b;

  insert into public.boss_strikes as s (boss_id, user_id, damage, runs, last_hit_at)
  values (b.id, uid, dmg, 1, now())
  on conflict (boss_id, user_id) do update
     set damage = s.damage + excluded.damage, runs = s.runs + 1, last_hit_at = now();

  if b.defeated_at is not null then
    perform public.spawn_world_boss();
  end if;

  return json_build_object('ok', true, 'id', b.id, 'name', b.name, 'dealt', dmg,
    'hp', b.hp, 'max_hp', b.max_hp, 'defeated', b.defeated_at is not null);
end;
$$;

-- Marks a fallen boss's reward as collected, once per player.
create function public.claim_world_boss_reward(p_boss_id bigint)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  s   public.boss_strikes;
  w   public.world_bosses;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  select * into w from public.world_bosses where id = p_boss_id;
  if not found or w.defeated_at is null then
    return json_build_object('ok', false, 'reason', 'not_defeated');
  end if;
  update public.boss_strikes set claimed = true
   where boss_id = p_boss_id and user_id = uid and not claimed
  returning * into s;
  if not found then
    return json_build_object('ok', false, 'reason', 'nothing_to_claim');
  end if;
  return json_build_object('ok', true, 'boss_id', w.id, 'name', w.name, 'damage', s.damage, 'max_hp', w.max_hp);
end;
$$;

revoke all on function public.spawn_world_boss() from public, anon, authenticated;
revoke all on function public.world_boss_status() from public;
revoke all on function public.strike_world_boss(bigint, int) from public, anon;
revoke all on function public.claim_world_boss_reward(bigint) from public, anon;
grant execute on function public.world_boss_status() to anon, authenticated;
grant execute on function public.strike_world_boss(bigint, int) to authenticated;
grant execute on function public.claim_world_boss_reward(bigint) to authenticated;

select public.spawn_world_boss();
