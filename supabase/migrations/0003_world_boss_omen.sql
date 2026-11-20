-- World boss Omen: while a world boss lives, every delve at every tier carries
-- its Omen (on top of the tier's weekly Omens) for extra loot luck. Each boss
-- name has a fixed Omen that matches its theme. The Omen ids must match
-- OmenId in sim/content/omens.ts.

alter table public.world_bosses
  add column omen text check (omen in ('kindledDead', 'sharedPain', 'quickened', 'warded', 'volatileGround'));

create or replace function public.spawn_world_boss()
returns public.world_bosses
language plpgsql security definer set search_path = ''
as $$
declare
  names  text[] := array['Grandmother Slag', 'The Cinder Colossus', 'Old Ashmaw', 'The Furnace Regent'];
  titles text[] := array['Mother of Kilns', 'Walking Forge', 'Eater of Embers', 'Lord of the Deep Bellows'];
  omens  text[] := array['kindledDead', 'warded', 'sharedPain', 'quickened'];
  n      int;
  last_fighters int;
  hp     bigint;
  b      public.world_bosses;
begin
  select count(*) into n from public.world_bosses;
  select count(*) into last_fighters from public.boss_strikes
   where boss_id = (select max(id) from public.world_bosses);
  hp := greatest(500000, 250000::bigint * last_fighters);
  insert into public.world_bosses (name, title, max_hp, hp, omen)
  values (names[1 + n % array_length(names, 1)], titles[1 + n % array_length(titles, 1)], hp, hp,
          omens[1 + n % array_length(omens, 1)])
  returning * into b;
  return b;
end;
$$;

create or replace function public.world_boss_status()
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
    'id', b.id, 'name', b.name, 'title', b.title, 'hp', b.hp, 'max_hp', b.max_hp, 'omen', b.omen,
    'started_at', b.started_at, 'fighters', fighters, 'my_damage', coalesce(mine, 0),
    'unclaimed', coalesce(unclaimed, '[]'::json));
end;
$$;

-- Bosses spawned before this migration take the Omen their name maps to.
update public.world_bosses set omen = case name
  when 'Grandmother Slag' then 'kindledDead'
  when 'The Cinder Colossus' then 'warded'
  when 'Old Ashmaw' then 'sharedPain'
  when 'The Furnace Regent' then 'quickened'
end
where omen is null;
