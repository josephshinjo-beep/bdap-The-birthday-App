# bdap: the birthday app

A class-based birthday app (PWA) for college students: secret reminders for classmates, UPI group contributions, and the birthday person never finds out.

- `docs/blueprint.html`: clickable prototype, plan and architecture (open it in a browser)
- `docs/PLAN_PROMPT.md`: the full product brief
- `CONTRIBUTING.md`: how to run it and who owns what

## Stack

Next.js 16 (App Router, TypeScript, Tailwind v4) · Supabase (Postgres, Auth, Realtime, Storage) · Vercel · Web Push.

## Quick start

```bash
npm install
npm run dev        # mock data, no backend needed
npm test           # UPI rotation, IST date helpers, redirect guard
```

## Going live (owner checklist)

1. **Supabase project.** Run `supabase/migrations/*.sql` in order (SQL editor or `supabase db push`). The migration also turns on Realtime for memberships and notifications.
2. **Google login.** Supabase → Authentication → Providers → Google: add the Google OAuth client ID and secret. In Authentication → URL configuration, set the Site URL to your domain and add `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback`) to the redirect URLs.
3. **VAPID keys.** `npx web-push generate-vapid-keys`.
4. **Vercel env vars** (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` (32+ random characters), `NEXT_PUBLIC_SITE_URL`.
5. **Domain.** Add the subdomain in Vercel, then in Cloudflare DNS add a `CNAME` to `cname.vercel-dns.com` (DNS only / grey cloud while Vercel issues the certificate).
6. **Reminders.** Enable `pg_cron` and `pg_net` in Supabase, then run `supabase/cron.sql` with your site URL and `CRON_SECRET`. It calls `POST /api/cron/reminders?slot=evening` at 6:00 PM IST and `slot=morning` at 7:30 AM IST. `vercel.json` has the same two jobs as an hourly-accuracy fallback; running twice never sends twice.

### Rehearse a reminder

```bash
curl -X POST "https://<your-domain>/api/cron/reminders?slot=evening" -H "Authorization: Bearer $CRON_SECRET"
```

Add `&date=YYYY-MM-DD` to pretend it's another day.

## How the secret is kept

- Row level security on every table; profiles are readable only by their owner.
- Classmates get birth day and month through `room_members()`, never the year.
- `celebrations` is invisible to its birthday person; `open_surprise`, `celebration_pool` and `celebration_payers` refuse them too.
- UPI rotation (`open_surprise`, mirrored in `src/lib/upi.ts`) fills UPI IDs in order, `payers_per_upi` each, skips the birthday person's own UPI ID, and falls back to the least-filled one while alerting moderators.
