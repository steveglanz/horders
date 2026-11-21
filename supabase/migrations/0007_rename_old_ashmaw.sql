-- Rename the world boss "Old Ashmaw" to "Old Coalmouth" (21 Nov 2026).
-- "Ashmaw" is a Warcraft character title, so the name goes. Its title, "Eater
-- of Embers", and its Omen (sharedPain) stay as they are.
--
-- 1. The rotation that spawn_world_boss() picks from now uses the new name.
-- 2. Bosses already spawned under the old name, the live one included, are
--    renamed, so the hub, strikes and unclaimed rewards all show the new name.
-- Nothing else keys on the name: boss_strikes points at world_bosses by id,
-- and the Omen is stored on each boss row (0003).

create or replace function public.spawn_world_boss()
returns public.world_bosses
language plpgsql security definer set search_path = ''
as $$
declare
  names  text[] := array['Grandmother Slag', 'The Cinder Colossus', 'Old Coalmouth', 'The Furnace Regent'];
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

update public.world_bosses set name = 'Old Coalmouth' where name = 'Old Ashmaw';
