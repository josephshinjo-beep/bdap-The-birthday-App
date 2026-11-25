-- bdap: schedule the reminder job with pg_cron + pg_net.
-- Run this once in the Supabase SQL editor AFTER the migrations, replacing the
-- two placeholders. It is not a migration because it holds a secret.
--
-- Dashboard → Database → Extensions: enable pg_cron and pg_net first.
-- pg_cron runs in UTC: 12:30 UTC = 6:00 PM IST, 02:00 UTC = 7:30 AM IST.

select vault.create_secret('https://YOUR-SUBDOMAIN.example.com', 'bdap_site_url');
select vault.create_secret('PASTE_THE_SAME_VALUE_AS_CRON_SECRET', 'bdap_cron_secret');

create or replace function public.call_reminder_job(p_slot text)
returns bigint language sql security definer set search_path = public as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'bdap_site_url')
           || '/api/cron/reminders?slot=' || p_slot,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'bdap_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$;
revoke execute on function public.call_reminder_job(text) from public, anon, authenticated;

select cron.schedule('bdap-evening-reminders', '30 12 * * *', $$ select public.call_reminder_job('evening') $$);
select cron.schedule('bdap-morning-reminders', '0 2 * * *',   $$ select public.call_reminder_job('morning') $$);

-- Check runs:   select * from cron.job_run_details order by start_time desc limit 10;
-- Responses:    select * from net._http_response order by created desc limit 10;
-- Unschedule:   select cron.unschedule('bdap-evening-reminders');
