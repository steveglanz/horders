-- Link codes: one hero across places. Players sign in anonymously, and every
-- storage area is its own place: a browser, an iPhone Home Screen web app
-- (WebKit gives it storage of its own, apart from Safari, webkit.org bug 181849)
-- and the store app. Each place is its own auth user. A link code lets a
-- second place read and write the first place's hero_saves row from then on.
--
-- save_links maps a place (user_id) to the place that owns the shared save
-- (owner_id). A place with no row owns its own save. Links never chain: when
-- an owner links to another save, everyone linked to it moves along.
-- Leaderboards, world boss strikes and bounty rows stay with each place.

create table public.save_links (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  linked_at timestamptz not null default now(),
  check (user_id <> owner_id)
);
create index save_links_owner on public.save_links (owner_id);

create table public.link_codes (
  code       text primary key,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null
);
create index link_codes_owner on public.link_codes (owner_id);

-- Only the functions below touch these tables.
alter table public.save_links enable row level security;
alter table public.link_codes enable row level security;
revoke all on public.save_links from anon, authenticated;
revoke all on public.link_codes from anon, authenticated;

-- The user whose hero_saves row this place reads and writes.
create or replace function public.save_owner()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce((select owner_id from public.save_links where user_id = auth.uid()), auth.uid());
$$;
revoke all on function public.save_owner() from public, anon, authenticated;

create or replace function public.load_save()
returns json
language plpgsql stable security definer set search_path = ''
as $$
declare
  owner uuid := public.save_owner();
begin
  if owner is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  return json_build_object('hero', (select hero from public.hero_saves where user_id = owner));
end;
$$;

create or replace function public.store_save(p_hero jsonb)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  owner uuid := public.save_owner();
begin
  if owner is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  if p_hero is null or jsonb_typeof(p_hero) <> 'object' then
    return json_build_object('ok', false, 'reason', 'bad_input');
  end if;
  insert into public.hero_saves (user_id, hero, updated_at) values (owner, p_hero, now())
    on conflict (user_id) do update set hero = excluded.hero, updated_at = excluded.updated_at;
  return json_build_object('ok', true);
end;
$$;

-- A code for this place's save: 8 letters and digits with no look-alikes
-- (no 0/O, 1/I/L), good for 15 minutes and one use. A new code replaces the old.
create or replace function public.make_link_code()
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  owner uuid := public.save_owner();
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  if owner is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  delete from public.link_codes where owner_id = owner or expires_at < now();
  loop
    c := '';
    for i in 1..8 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.link_codes (code, owner_id, expires_at) values (c, owner, now() + interval '15 minutes');
      exit;
    exception when unique_violation then
      -- Try another code.
    end;
  end loop;
  return json_build_object('ok', true, 'code', c, 'expires_in', 900);
end;
$$;

-- Links this place to the code's save and returns that save's hero (null if
-- the other place never saved). The client keeps whichever hero has made more
-- progress and stores it with store_save.
create or replace function public.redeem_link_code(p_code text)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  code_owner uuid;
  clean text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  delete from public.link_codes where code = clean and expires_at >= now() returning owner_id into code_owner;
  if code_owner is null then
    return json_build_object('ok', false, 'reason', 'bad_code');
  end if;
  if code_owner = public.save_owner() then
    return json_build_object('ok', true, 'same', true, 'hero', (select hero from public.hero_saves where user_id = code_owner));
  end if;
  -- Places linked to this one follow it to the new save.
  update public.save_links set owner_id = code_owner where owner_id = uid and user_id <> code_owner;
  delete from public.save_links where user_id = code_owner and owner_id = uid;
  if code_owner = uid then
    delete from public.save_links where user_id = uid;
  else
    insert into public.save_links (user_id, owner_id) values (uid, code_owner)
      on conflict (user_id) do update set owner_id = excluded.owner_id, linked_at = now();
  end if;
  return json_build_object('ok', true, 'hero', (select hero from public.hero_saves where user_id = code_owner));
end;
$$;

revoke all on function public.load_save() from public, anon;
revoke all on function public.store_save(jsonb) from public, anon;
revoke all on function public.make_link_code() from public, anon;
revoke all on function public.redeem_link_code(text) from public, anon;
grant execute on function public.load_save() to authenticated;
grant execute on function public.store_save(jsonb) to authenticated;
grant execute on function public.make_link_code() to authenticated;
grant execute on function public.redeem_link_code(text) to authenticated;

-- Delete my account (0008) also clears this place's links and codes. Places
-- linked to it keep their own local copy and save on their own again.
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
  delete from public.save_links   where user_id = uid or owner_id = uid;
  delete from public.link_codes   where owner_id = uid;
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
