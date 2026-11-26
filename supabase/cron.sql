-- bdap: schedule the reminder job with pg_cron + pg_net.
-- Run this once in the Supabase SQL editor AFTER the migrations, replacing the
-- two placeholders. It is not a migration because it holds a secret.
--
-- Dashboard → Database → Extensions: enable pg_cron and pg_net first.
-- The job runs every 15 minutes; each room's own reminder times (set by its
-- admins) decide what is sent, so reminders go out within 15 minutes of the
-- chosen time.

select vault.create_secret('https://bdap.surf', 'bdap_site_url');
select vault.create_secret('PASTE_THE_SAME_VALUE_AS_CRON_SECRET', 'bdap_cron_secret');

create or replace function public.call_reminder_job()
returns bigint language sql security definer set search_path = public as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'bdap_site_url')
           || '/api/cron/reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'bdap_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$;
revoke execute on function public.call_reminder_job() from public, anon, authenticated;

-- If you scheduled the old twice-a-day jobs, remove them (errors are fine if they don't exist).
-- select cron.unschedule('bdap-evening-reminders');
-- select cron.unschedule('bdap-morning-reminders');

select cron.schedule('bdap-reminders', '*/15 * * * *', $$ select public.call_reminder_job() $$);

-- Check runs:   select * from cron.job_run_details order by start_time desc limit 10;
-- Responses:    select * from net._http_response order by created desc limit 10;
-- Unschedule:   select cron.unschedule('bdap-reminders');
