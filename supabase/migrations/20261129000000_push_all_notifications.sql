-- bdap: push every notification, not only birthday reminders.
--
-- Before this, only the reminder job sent pushes, so join requests, approvals,
-- expense requests and approvals, and new polls reached the in-app bell only.
--
-- How it works now:
--   1. After rows are inserted into notifications, a statement trigger asks the app
--      (through pg_net, after the transaction commits) to POST /api/push/dispatch.
--   2. That route claims unpushed rows with claim_unpushed_notifications() and pushes them.
--   3. The 15-minute reminder job sweeps up anything from the last hour that was missed.
--
-- Needs: pg_net enabled, and the bdap_site_url and bdap_cron_secret Vault secrets
-- from supabase/cron.sql. Without them the trigger does nothing and the reminder
-- job's sweep still sends pushes (up to 15 minutes later).
-- Safe to run more than once.

create index if not exists notifications_unpushed_idx
  on public.notifications (created_at) where pushed_at is null;

-- Claim up to p_limit notifications created since p_since that haven't been pushed,
-- marking them pushed in the same statement. SKIP LOCKED means two overlapping calls
-- never get the same row, so nothing is sent twice.
create or replace function public.claim_unpushed_notifications(p_since timestamptz, p_limit int default 500)
returns table (notification_id uuid, user_id uuid, title text, body text, url text, priority boolean)
language sql security definer set search_path = public as $$
  update notifications n
  set pushed_at = now()
  where n.id in (
    select q.id from notifications q
    where q.pushed_at is null and q.created_at >= p_since
    order by q.created_at
    limit least(greatest(p_limit, 1), 1000)
    for update skip locked
  )
  returning n.id, n.user_id, n.title, n.body, n.url, n.priority;
$$;
revoke execute on function public.claim_unpushed_notifications(timestamptz, int) from public, anon, authenticated;
grant execute on function public.claim_unpushed_notifications(timestamptz, int) to service_role;

-- Queue one HTTP call per INSERT statement. pg_net sends it only after the
-- transaction commits (and drops it on rollback), so the rows are visible to the app.
-- Any failure here is swallowed: a notification must never fail to save because
-- the push couldn't be queued.
create or replace function public.queue_push_dispatch()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'bdap_site_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'bdap_cron_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/push/dispatch',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  return null;
exception when others then
  return null;
end;
$$;
revoke execute on function public.queue_push_dispatch() from public, anon, authenticated;

drop trigger if exists notifications_push_dispatch on public.notifications;
create trigger notifications_push_dispatch
  after insert on public.notifications
  for each statement execute function public.queue_push_dispatch();
