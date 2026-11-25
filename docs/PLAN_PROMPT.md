You are building **bdap — the birthday app**: a class-based birthday celebration web app (PWA) for college students. It automatically reminds classmates about each other's birthdays, coordinates a secret celebration, and collects group contributions through UPI, while the birthday person never finds out. It is a fun project that solves a real problem, so keep the UI playful and interactive.

## Decisions already made (do not re-ask)
1. Login: Google sign-in only, via Supabase Auth. After first login, the user completes a one-time profile: full name, username, date of birth.
2. Audience: college students first. Never show anyone's birth year to others, only day and month.
3. Notifications: in-app feed + browser/Web Push. The app is a PWA (installable, service worker). On iPhone, push works only after "Add to Home Screen" (iOS 16.4+).
4. Money: a room can have 2–3 (or more) UPI IDs, each linked to the member who owns it. Rotation: fill UPI IDs in order until each has `payers_per_upi` people assigned (moderator sets it, default 20), then move to the next. Skip any UPI ID owned by the birthday person (this covers the moderator's own birthday). If all are full, use the least-filled one and alert the moderators to add another. Each payer is assigned once per celebration and always sees the same QR.
5. Amount: the moderator chooses the mode per room: fixed, suggested, or any amount.
6. A student can be in multiple rooms (class, hostel, club).
7. Pool visibility: members see the pool total ("18 of 40 chipped in · ₹900"); moderator and co-moderators also see who paid. The birthday person sees none of it.
8. Stack: Next.js 16 (App Router, TypeScript, Tailwind v4) + Supabase (Postgres, Auth, Realtime, Storage) + Vercel hosting. The domain's DNS stays on Cloudflare with a record pointing at Vercel.
9. Look and feel: the current style is a placeholder. All colours and fonts live in one theme file so the new design (coming later from the owner) is a quick swap.

Note: Next.js 16 renames Middleware to **Proxy** (`src/proxy.ts`). Read `node_modules/next/dist/docs/` before writing Next.js code; `params`, `searchParams` and `cookies()` are async.

## User flows
**Milestone 1: rooms and enrolment**
- Home (`/`): interactive hero, "How it works" cards (join with code → moderator lets you in → secret heads-up → chip in with UPI), a privacy callout, main button "Join your class room", secondary "Create a room for your class", "Log in" top right.
- Join (`/join`): 6 character boxes for the room code (auto-advance, uppercase, not case-sensitive). Valid code shows a room preview (name, member count, moderator's first name). Button "This is my class →".
- Enrol: if the user has no profile, collect full name, username (live availability check, `^[a-z0-9._]{3,24}$`) and DOB (hint: classmates only see day and month). Button "Send join request".
- Waiting (`/rooms/[id]/waiting`): animated envelope, status timeline (code checked → details sent → waiting for moderator → welcome). Switches to the room automatically via Supabase Realtime when approved.
- Room (`/rooms/[id]`): tabs Upcoming / Members / Me. A "next secret celebration" card with live countdown and "Open the surprise →" (never shown to the birthday person). An upcoming birthdays list; your own birthday shows "That's you — your room goes quiet for you".
- Create room (`/create`): room name, UPI IDs (add 2–3, each with payee name and owner member; optionally upload a QR image), amount mode + amount, payers per UPI ID, reminder switches (week before off, day before 6:00 PM on, on the day 7:30 AM on). On success, show the room code as a ticket with a Copy button.
- Moderator dashboard (`/rooms/[id]/manage`): room code ticket + copy + share, join requests with "Let in" / decline, member list, set co-moderators, remove members, view as member.
- Edit room (`/rooms/[id]/manage/edit`): all room settings, manage UPI IDs, choose co-moderator, "Make a new code" (existing members stay).

**Milestone 2: secret reminders and UPI**
- A scheduled job runs at 6:00 PM IST (week-before and day-before reminders) and 7:30 AM IST (on-the-day). It is triggered by Supabase `pg_cron` + `pg_net` calling `POST /api/cron/reminders?slot=evening|morning` with header `Authorization: Bearer $CRON_SECRET`. Vercel Cron can be a fallback, but its free tier is only accurate to the hour.
- The job creates celebrations for birthdays in the next 7 days and sets status upcoming → live → done. It inserts reminder notifications for every approved member except the birthday person, idempotently (one per user + celebration + kind), and sends Web Push to their subscriptions. It deletes subscriptions that return 404/410.
- 29 Feb birthdays are celebrated on 28 Feb in non-leap years. All dates are in Asia/Kolkata.
- Surprise page (`/rooms/[id]/surprise/[celebrationId]`): tap the gift 3 times (shake, confetti) → scratch card (canvas) hides the UPI QR → reveals the QR, UPI ID, payee and amount, a "Pay with a UPI app" button and a "Reveal without scratching" fallback. The QR is generated from `upi://pay?pa=<upi>&pn=<payee>&am=<amount>&cu=INR&tn=<Name> birthday`, or the uploaded QR image is shown. Below it: an "I've chipped in" tick (self-reported; the app cannot verify UPI payments without a payment gateway) and the pool progress bar.
- A notification bell / in-app feed with unread count, live via Realtime. A push opt-in prompt, with "add to home screen" instructions on iOS.

**Later (owner picks):** secret wish wall revealed at midnight, gift poll, birthday reveal page for the birthday person, photo memories, WhatsApp share of the room code, custom themes.

## Data model (Supabase, `supabase/migrations/`)
- `profiles(id → auth.users, full_name, username unique, dob, avatar_url)`
- `rooms(id, name, code unique 6 chars from ABCDEFGHJKMNPQRSTUVWXYZ23456789, amount_mode fixed|suggested|any, amount, payers_per_upi default 20, remind_week_before, remind_day_before, remind_on_day, created_by)`
- `memberships(room_id, user_id, role moderator|co_moderator|member, status pending|approved|declined, requested_at, decided_at, decided_by)`
- `room_upi_accounts(id, room_id, upi_id, payee_name, owner_user_id, qr_image_url, sort_order, active)`
- `celebrations(id, room_id, birthday_user_id, celebration_date, status upcoming|live|done)`, unique per room + person + date
- `contributions(celebration_id, user_id, upi_account_id, amount, assigned_at, marked_paid_at)`
- `notifications(id, user_id, room_id, celebration_id, kind, title, body, url, read_at, pushed_at)`
- `push_subscriptions(id, user_id, endpoint unique, p256dh, auth)`

**Security (non-negotiable):**
- RLS is enabled on every table.
- Profiles are readable only by their owner. Other people's data comes only through SECURITY DEFINER RPCs that check membership and return birth month and day only.
- Celebrations are never readable by their birthday person: the policy requires `is_room_member(room_id) and birthday_user_id <> auth.uid()`.
- Writes that affect others (approve, roles, codes, UPI assignment) are RPCs only.
- `prepare_reminders` is executable by the service role only.
- The service-role key is used only on the server (cron route, push sending) and is never sent to the browser.

**RPCs:** `username_available`, `preview_room(code)`, `request_join(code)`, `create_room(...)`, `regenerate_room_code`, `decide_request(room, user, approve)`, `set_member_role` (moderator only), `remove_member`, `room_members(room)`, `open_surprise(celebration)` (does the UPI rotation with an advisory lock), `mark_paid`, `celebration_pool`, `celebration_payers` (admins only), `prepare_reminders(today, kind)`.

## Code structure
```
src/app/                      pages (routes above), /login, /auth/callback, /onboarding, /me, /api/cron/reminders, /api/push
src/app/manifest.ts           PWA manifest
public/sw.js                  service worker: push + notificationclick → open url
src/proxy.ts                  refreshes the Supabase session, guards /rooms, /create, /me
src/lib/types.ts              shared TypeScript contracts (Room, Member, Celebration, UpiAccount, Surprise, Pool, Notification)
src/lib/data/                 data layer: one interface, two implementations
  index.ts                    picks "mock" when Supabase env vars are missing, else "supabase"
  mock.ts                     in-memory sample data + a demo user switcher (member / moderator / birthday person)
  supabase.ts                 real calls (RPCs above)
src/lib/upi.ts                pickUpiAccount() pure function (mirrors the SQL rotation, unit-tested) + buildUpiLink()
src/lib/dates.ts              IST helpers, next birthday, 29 Feb rule (unit-tested)
src/lib/push.ts               web-push sending with VAPID keys
src/lib/supabase/             server.ts, client.ts, admin.ts (service role)
src/components/               UI components; the frontend partner owns these
src/styles/theme.css          all colours/fonts as CSS variables; the frontend partner owns this
.env.example                  NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET, NEXT_PUBLIC_SITE_URL
```

## Team workflow
- Two people. Backend (database, RPCs, data layer, auth, cron, push, UPI logic) and frontend (pages, components, animations, theme, PWA UI) work in parallel.
- The frontend builds against the mock data layer, so it never waits for the backend. The backend later swaps in Supabase without page changes.
- Do not change shared types silently; announce changes first. The frontend doesn't edit `src/lib/data/supabase.ts`, `src/lib/supabase/` or `supabase/`; the backend doesn't edit components or styling.
- Branches: `main` (working version), one feature branch per person. Small pull requests merged every few days, not one big merge at the end.
- Commit and push with git after every meaningful step.

## Milestones and "done when"
- **M0 setup:** scaffold, theme file, types, mock data layer, Supabase clients, Google login, PWA manifest + service worker, `.env.example`, CONTRIBUTING.md, deploy to Vercel. Done when a live URL shows the home page and Google login works.
- **M1:** all M1 flows above, against Supabase. Done when the owner creates a room, 3 friends join, the owner approves 2 and declines 1, and the approved ones land in the room automatically.
- **M2:** cron, reminders, push, surprise page, UPI rotation, pool. Done when, with a test birthday set to tomorrow, everyone except that person gets the 6 PM reminder and can unwrap the QR, and the 21st payer is assigned the second UPI ID.
- Unit-test `pickUpiAccount` and the date helpers. Run `npm run lint` and `npm run build` before each push.

## Current state of the repo (branch `claude/wizardly-mccarthy-j1xvmj`)
- `docs/blueprint.html`: clickable prototype of all 10 screens, plus the plan and architecture. Open it in a browser.
- The Next.js 16 scaffold, with `@supabase/supabase-js`, `@supabase/ssr` and `web-push` installed.
- `supabase/migrations/20261125000000_init.sql`: first draft of the full schema, RLS and RPCs above. Not yet applied to a Supabase project.
- Next: types, data layer (mock + Supabase), theme file, auth, pages.

## What the owner provides
A Supabase project (URL + anon key; the service-role key goes only into Vercel env vars, never into chat), Google OAuth enabled in Supabase (Authentication → Providers → Google), a Vercel project linked to the GitHub repo, and a Cloudflare DNS record for the subdomain pointing at Vercel.
