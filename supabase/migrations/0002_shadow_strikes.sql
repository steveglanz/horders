-- Shadow fight: damage dealt to the world boss's shadow (the bonus fight after
-- a won delve) counts triple. The old two-argument function is replaced by one
-- whose extra arguments default to zero, so older clients keep working.

drop function if exists public.strike_world_boss(bigint, int);

create function public.strike_world_boss(
  p_damage bigint, p_seconds int, p_shadow_damage bigint default 0, p_shadow_seconds int default 0
)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  uid    uuid := auth.uid();
  b      public.world_bosses;
  delve  bigint;
  shadow bigint;
  dmg    bigint;
  last   timestamptz;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  -- Clamp each part to what a run could plausibly deal.
  delve  := greatest(0, least(coalesce(p_damage, 0), greatest(0, coalesce(p_seconds, 0)) * 400::bigint, 60000));
  shadow := greatest(0, least(coalesce(p_shadow_damage, 0), greatest(0, least(coalesce(p_shadow_seconds, 0), 60)) * 600::bigint, 36000));
  dmg := delve + 3 * shadow;

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

  return json_build_object('ok', true, 'id', b.id, 'name', b.name, 'dealt', dmg, 'shadow', 3 * shadow,
    'hp', b.hp, 'max_hp', b.max_hp, 'defeated', b.defeated_at is not null);
end;
$$;

revoke all on function public.strike_world_boss(bigint, int, bigint, int) from public, anon;
grant execute on function public.strike_world_boss(bigint, int, bigint, int) to authenticated;
