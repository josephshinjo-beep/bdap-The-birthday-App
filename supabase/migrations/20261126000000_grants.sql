-- bdap: explicit table privileges.
--
-- Newer Supabase projects no longer grant the API roles access to new tables
-- automatically, which shows up as "permission denied for table profiles" on
-- login. Grant exactly what the app needs; row level security still decides
-- which rows each person can see or change.

grant usage on schema public to anon, authenticated, service_role;

-- The server-side jobs (cron, push) use the service role and need everything.
grant all on all tables in schema public to service_role;

-- profiles: read and create your own row; edit only these columns (never id).
grant select, insert on public.profiles to authenticated;
grant update (full_name, username, dob, avatar_url) on public.profiles to authenticated;

-- rooms: read rooms you belong to; settings edits are column-limited (see hardening).
grant select on public.rooms to authenticated;
grant update (name, amount_mode, amount, payers_per_upi,
              remind_week_before, remind_day_before, remind_on_day)
  on public.rooms to authenticated;

-- memberships: read your own (admins: their room's); leave a room. Joining and
-- approving go through request_join() / decide_request().
grant select, delete on public.memberships to authenticated;

-- UPI accounts: admins manage them (RLS: upi_admin_all).
grant select, insert, update, delete on public.room_upi_accounts to authenticated;

-- celebrations and contributions: read only (RLS hides your own birthday).
grant select on public.celebrations to authenticated;
grant select on public.contributions to authenticated;

-- notifications: read your own, mark them read.
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- push subscriptions: your own devices.
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Signed-out visitors get no table access at all.
revoke all on all tables in schema public from anon;
