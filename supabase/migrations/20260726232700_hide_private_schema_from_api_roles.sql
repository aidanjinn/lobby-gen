-- Private password hashes and abuse-control state must never be reachable via
-- the Data API. Public SECURITY DEFINER RPCs mediate the approved operations.
revoke all on schema app_private from public, anon, authenticated;
revoke all privileges on all tables in schema app_private from public, anon, authenticated;
revoke all privileges on all sequences in schema app_private from public, anon, authenticated;
revoke execute on all functions in schema app_private from public, anon, authenticated;
