-- RLS policies call these helpers as the authenticated role. Expose only the
-- schema name and these two functions; private tables and secret-management
-- functions remain inaccessible.
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_session_member(uuid, uuid) to authenticated;
grant execute on function app_private.shares_session(uuid, uuid) to authenticated;
