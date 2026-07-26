create extension if not exists "pgcrypto";
create type session_frequency as enum ('weekly', 'biweekly', 'monthly');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  steam_id text unique not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now()
);
create table game_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references profiles(id),
  name text not null,
  invite_code text unique not null,
  password_hash text,
  frequency session_frequency not null default 'weekly',
  locked_start timestamptz,
  created_at timestamptz default now()
);
create table session_members (
  session_id uuid references game_sessions on delete cascade,
  user_id uuid references profiles on delete cascade,
  preferred_day smallint check (preferred_day between 0 and 6),
  preferred_start time,
  timezone text not null default 'UTC',
  primary key (session_id, user_id)
);
create table availability (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references game_sessions on delete cascade,
  user_id uuid references profiles on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  kind text not null check (kind in ('work', 'available')),
  check (end_time > start_time)
);
create table steam_games (
  app_id bigint primary key,
  name text not null,
  header_image text,
  max_players integer,
  metadata jsonb default '{}'
);
create table user_games (
  user_id uuid references profiles on delete cascade,
  app_id bigint references steam_games on delete cascade,
  playtime_minutes integer default 0,
  primary key (user_id, app_id)
);
create index availability_session_idx on availability(session_id, day_of_week);
create index session_members_user_idx on session_members(user_id);
create index user_games_app_idx on user_games(app_id);

create or replace function is_session_member(check_session uuid, check_user uuid default auth.uid())
returns boolean language sql security definer set search_path = public stable as $$
  select exists(select 1 from session_members where session_id = check_session and user_id = check_user)
$$;

create or replace function join_game_session(code text, supplied_password text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare target game_sessions;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into target from game_sessions where invite_code = upper(trim(code));
  if target.id is null then raise exception 'Session not found'; end if;
  if target.password_hash is not null and
     (supplied_password is null or crypt(supplied_password, target.password_hash) <> target.password_hash)
  then raise exception 'Invalid password'; end if;
  insert into session_members(session_id, user_id)
  values(target.id, auth.uid()) on conflict do nothing;
  return target.id;
end $$;

create or replace function set_session_password(target_session uuid, new_password text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from game_sessions where id=target_session and host_id=auth.uid()) then
    raise exception 'Only the host can change the password';
  end if;
  update game_sessions set password_hash = case when nullif(new_password, '') is null then null else crypt(new_password, gen_salt('bf')) end
  where id=target_session;
end $$;
alter table profiles enable row level security;
alter table game_sessions enable row level security;
alter table session_members enable row level security;
alter table availability enable row level security;
alter table user_games enable row level security;
alter table steam_games enable row level security;
create policy "profiles visible to authenticated" on profiles for select to authenticated using (true);
create policy "users create self" on profiles for insert to authenticated with check (auth.uid() = id);
create policy "users update self" on profiles for update using (auth.uid() = id);
create policy "members view sessions" on game_sessions for select to authenticated using (host_id = auth.uid() or is_session_member(id));
create policy "hosts create sessions" on game_sessions for insert to authenticated with check (host_id=auth.uid());
create policy "hosts update sessions" on game_sessions for update to authenticated using (host_id=auth.uid()) with check (host_id=auth.uid());
create policy "hosts delete sessions" on game_sessions for delete to authenticated using (host_id=auth.uid());
create policy "members view membership" on session_members for select to authenticated using (is_session_member(session_id));
create policy "users update own membership" on session_members for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "users leave sessions" on session_members for delete to authenticated using (user_id=auth.uid());
create policy "members view availability" on availability for select to authenticated using (is_session_member(session_id));
create policy "users add availability" on availability for insert to authenticated with check (user_id=auth.uid() and is_session_member(session_id));
create policy "users update availability" on availability for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "users delete availability" on availability for delete to authenticated using (user_id=auth.uid());
create policy "authenticated read game catalog" on steam_games for select to authenticated using (true);
create policy "users view group libraries" on user_games for select to authenticated using (user_id=auth.uid() or exists(select 1 from session_members me join session_members them on me.session_id=them.session_id where me.user_id=auth.uid() and them.user_id=user_games.user_id));
create policy "users add own games" on user_games for insert to authenticated with check (user_id=auth.uid());
create policy "users update own games" on user_games for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "users delete own games" on user_games for delete to authenticated using (user_id=auth.uid());

revoke all on function join_game_session(text,text) from public;
grant execute on function join_game_session(text,text) to authenticated;
revoke all on function set_session_password(uuid,text) from public;
grant execute on function set_session_password(uuid,text) to authenticated;
