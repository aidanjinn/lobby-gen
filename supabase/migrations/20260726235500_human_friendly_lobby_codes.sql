create or replace function public.create_game_session(
  session_name text,
  session_frequency public.session_frequency,
  session_password text default null,
  member_timezone text default 'UTC'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  new_id uuid;
  new_code text;
  random_data bytea;
begin
  if auth.uid() is null then return null; end if;
  if length(trim(session_name)) < 2 or length(trim(session_name)) > 80 then return null; end if;
  if (select count(*) from game_sessions where host_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then return null; end if;

  loop
    random_data := extensions.gen_random_bytes(8);
    select string_agg(
      substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + (get_byte(random_data, i) % 32), 1),
      '' order by i
    )
    into new_code
    from generate_series(0, 7) as positions(i);
    exit when not exists (select 1 from game_sessions where invite_code = new_code);
  end loop;

  insert into game_sessions(host_id, name, invite_code, frequency)
  values(auth.uid(), trim(session_name), new_code, session_frequency)
  returning id into new_id;

  if nullif(session_password, '') is not null then
    insert into app_private.session_secrets(session_id, password_hash)
    values(new_id, extensions.crypt(session_password, extensions.gen_salt('bf')));
  end if;

  insert into session_members(session_id, user_id, timezone)
  values(new_id, auth.uid(), coalesce(nullif(member_timezone, ''), 'UTC'));

  return new_id;
end
$function$;

revoke all on function public.create_game_session(text, public.session_frequency, text, text) from public, anon;
grant execute on function public.create_game_session(text, public.session_frequency, text, text) to authenticated;
