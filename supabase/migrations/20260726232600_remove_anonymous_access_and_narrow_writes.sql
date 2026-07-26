-- Defense in depth: RLS remains the primary row boundary, while grants remove
-- capabilities that anonymous and authenticated clients never need.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;

revoke all privileges on public.availability from authenticated;
grant select, insert, delete on public.availability to authenticated;

revoke all privileges on public.game_sessions from authenticated;
grant select, delete on public.game_sessions to authenticated;

revoke all privileges on public.profile_schedule from authenticated;
grant select, insert, delete on public.profile_schedule to authenticated;
grant update (day_of_week, start_time, end_time, kind) on public.profile_schedule to authenticated;

revoke all privileges on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (default_preferred_day, default_preferred_start, timezone) on public.profiles to authenticated;

revoke all privileges on public.session_members from authenticated;
grant select, delete on public.session_members to authenticated;
grant update (preferred_day, preferred_start, timezone) on public.session_members to authenticated;

revoke all privileges on public.steam_games from authenticated;
grant select on public.steam_games to authenticated;

revoke all privileges on public.user_games from authenticated;
grant select on public.user_games to authenticated;

revoke all privileges on all sequences in schema public from authenticated;
