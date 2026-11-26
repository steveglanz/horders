-- Delete my account (1.0 M6, roadmap Phase 19 P1; Apple 5.1.1(v), Google Play
-- account deletion). A signed-in player removes their own auth user, and with it
-- every row they own: hero_saves, boss_strikes, key_bests and bounty_bests all
-- reference auth.users (id) on delete cascade. The deletes below name each table
-- anyway, so a future table that forgets the cascade still has to be added here.
-- World boss hp already dealt stays dealt (it holds no player id).

create or replace function public.delete_my_account()
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  delete from public.hero_saves   where user_id = uid;
  delete from public.boss_strikes where user_id = uid;
  delete from public.key_bests    where user_id = uid;
  delete from public.bounty_bests where user_id = uid;
  delete from auth.users where id = uid;
  return json_build_object('ok', true);
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
