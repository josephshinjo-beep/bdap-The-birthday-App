# bdap — the birthday app 🎂

**Never miss a classmate's birthday. They never see it coming.**

bdap is a birthday app for college classes. It reminds everyone the evening before a classmate's birthday, keeps the whole thing secret from the birthday person, and collects the gift money over UPI. It's an installable web app (PWA), so it works on any phone without an app store.

---

## Contents

- [How it works](#how-it-works)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start (no backend needed)](#quick-start-no-backend-needed)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [Data model](#data-model)
- [How the secret is kept](#how-the-secret-is-kept)
- [UPI rotation](#upi-rotation)
- [Reminders and push notifications](#reminders-and-push-notifications)
- [Going live](#going-live)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Testing](#testing)
- [Changing the look](#changing-the-look)
- [Team workflow](#team-workflow)
- [Roadmap](#roadmap)
- [Troubleshooting](#troubleshooting)

---

## How it works

1. **Join with a code.** The class rep creates a room and shares a 6-character code. Classmates type it in and add their name, username and date of birth.
2. **The moderator lets you in.** Only people the moderator (or a co-moderator) approves can see the room.
3. **The admins decide.** A month ahead, the room's admins choose for each birthday: **Celebrate** (secret reminders and a UPI collection) or **Just wish**.
4. **A secret heads-up.** For approved birthdays, everyone gets a reminder at the times the admins chose (6:00 PM the evening before by default). Everyone except the birthday person.
5. **Chip in with UPI.** Tap the gift three times, scratch the card, and pay from any UPI app. Everyone watches the pool fill up.
6. **Happy birthday!** On the day, the birthday person gets a wish from the room, whether or not there was a collection.

## Features

### Rooms and joining (Milestone 1)

| Screen | Path | What it does |
|---|---|---|
| Home | `/` | Interactive gift hero, how-it-works cards, privacy promise |
| Log in | `/login` | Google sign-in (plus a demo-user picker in mock mode) |
| Profile setup | `/onboarding` | One-time full name, username (live availability check) and date of birth |
| Join | `/join` | Six code boxes (auto-advance, paste-friendly, not case-sensitive), room preview, then "This is my class →" |
| Waiting | `/rooms/[id]/waiting` | Animated envelope and status timeline; moves into the room by itself when approved |
| My rooms | `/rooms` | Every room you're in: class, hostel, club |
| Room | `/rooms/[id]` | Tabs for Upcoming / Members / Me, next secret celebration with a live countdown, upcoming birthdays |
| Create room | `/create` | Name, UPI IDs (with owner and optional QR image), amount mode, payers per UPI ID, reminder switches; ends with the room code as a ticket |
| Admin dashboard | `/rooms/[id]/manage` | Tabs: **Overview** (stats, alerts, join requests, code, reminder summary), **Birthdays** (approve Celebrate / Just wish / undo for the next 30 days), **Members** (let in, decline, co-moderators, remove), **Settings** (shortcuts) |
| Edit room | `/rooms/[id]/manage/edit` | All settings, custom reminder times, auto-approve, birthday wish, add / edit / pause / delete UPI IDs, co-moderators, "Make a new code", delete the room |
| Profile | `/me` | Edit profile, turn push notifications on or off, log out |

### Secret reminders and UPI (Milestone 2)

- **Surprise page** (`/rooms/[id]/surprise/[celebrationId]`): tap the gift 3 times (shake and confetti), scratch the card, and get the UPI QR, UPI ID, payee and amount. A "Pay with a UPI app" button opens GPay, PhonePe, Paytm or a bank app. "Reveal without scratching" is there for keyboards, screen readers and anyone who'd rather not drag.
- **"I've chipped in"** tick. It's self-reported, because UPI doesn't tell the app about payments (that would need a payment gateway).
- **Pool**: everyone sees "10 of 21 chipped in · ₹650". Moderators also see who paid.
- **Notification bell** with an unread count and a live feed.
- **Web Push** reminders, with "Add to Home Screen" steps for iPhone.
- **Scheduled job** every 15 minutes; each room's own reminder times decide what goes out.

### Admin controls

Each room's moderator and co-moderators get a dashboard to run it:

- **Approve each birthday.** Nothing about a celebration reaches the class until an admin picks **Celebrate**. **Just wish** (or no decision) means no reminders and no collection; on the day the class gets a nudge to wish them. Admins are asked a month ahead, can change their mind or undo, and never see or decide their own birthday.
- **Auto-approve** (optional): every new birthday starts as Celebrate.
- **Custom reminder times** in India time for the week-before, day-before and on-the-day reminders, each with its own on/off switch.
- **Birthday wish**: on the day, the birthday person gets a "Happy birthday" from the room (can be switched off).
- **Edit and delete everything**: room settings, UPI IDs (add, edit, pause, delete), members (remove, co-moderator), the room code, and the room itself (moderator only, by typing its name).

### Celebration plans, splits and votes

- **What for, total and plan:** for each birthday, admins add what the money is for ("Cake 🎂 and a gift"), the total expense and the plan for the day ("Cake cutting at 4:30 PM in the CSE lab"), from **Dashboard → Birthdays → Plan, total & vote** (`/rooms/[id]/manage/celebrations/[celebrationId]`).
- **Equal split with a floor:** the total is split equally between everyone except the birthday person, rounded up. Each member's share is suggested on the surprise page, and **nobody can chip in less than their share** (more is fine). The app and the database both enforce this.
- **Cake vote:** admins add options with prices ("Chocolate truffle ₹1,050", "Red velvet ₹1,200"). Members vote and can change their vote. When an admin closes the vote, the winning option's price becomes the total and the split updates. Ties go to the cheaper option.

### Class reps and class expenses

- **Class rep role:** the moderator can make any member a *class rep* (Dashboard → Members → role picker). Reps aren't admins: they can't see undecided birthdays or change settings.
- **Splits for anything:** reps start a split for any class expense (a trip, printouts, a farewell gift): title, details, total, due date and which UPI ID collects. Admins approve or decline it, and **the class only sees it once approved**. Splits that admins start themselves go out straight away.
- **Pay your share:** members see approved splits under **Room → Expenses**, with a UPI QR and pay link for their equal share (never less) and an "I've paid" tick.
- **Record payments:** reps and admins open "Record payments" to mark who paid, for example cash handed over. The list shows whether each payment was self-reported or recorded by a rep. Reps can also record payments for birthday collections.
- Admins close a collection when it's done, or delete it. Reps can withdraw a request that hasn't been approved.

### The birthday wall

- **Paper notes on a wall:** classmates stick notes on the birthday person's wall (`/rooms/[id]/wall/[celebrationId]`), choosing a paper colour. Notes are taped on at a slight angle and can be **dragged** to a new spot, or moved with the arrow keys.
- **Revealed on the day:** before the birthday, classmates can see and add to the public wall; the birthday person can't open it at all (the database refuses). On the day they get a "your wall is ready" banner and notification, and can arrange every note.
- **Private messages:** tick "🔒 Private message" and only the birthday person can read the note. Other classmates never see it.
- **One-tap Instagram card:** "📸 Share to Instagram" draws a 1080×1920 story card with two designs (Party night, Sunshine). It shows the name, room, note count, an editable line (prefilled with the plan) and up to three public notes; private notes are never included. On a phone, **Share** opens the share sheet, where Instagram appears; elsewhere it downloads the image.
- Up to 5 notes per person per birthday. Authors can delete their notes, and admins can remove inappropriate ones.

### Fun touches

- **Poppable balloons** on the home page: glossy balloons with a shine, a knot and a curly string, swaying as they float. Tap one and it bursts with a pop sound and a puff of confetti, then a new one floats back up. Motion is reduced if the phone asks for it.

### Rules the app follows

- Only the day and month of a birthday are shown to others, never the year.
- The birth year must be before the current year (so 2026 sign-ups pick 2025 or earlier).
- A date of birth is locked once saved. Nobody can change it from the app; the owner can fix a genuine mistake in the Supabase SQL editor.
- 29 February birthdays are celebrated on 28 February in non-leap years.
- All dates use India time (Asia/Kolkata), whatever the phone's time zone.
- Amount mode is set per room: **fixed** (everyone pays the same), **suggested** (a nudge) or **any amount**.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, TypeScript, Cache Components) |
| Styling | Tailwind CSS v4, with every colour and font in one theme file |
| Backend | [Supabase](https://supabase.com): Postgres, Auth (Google), Realtime, Storage |
| Notifications | Web Push (VAPID) through a service worker; every notification is pushed within seconds by a database trigger that calls `/api/push/dispatch` |
| Scheduling | Supabase `pg_cron` + `pg_net`, with Vercel Cron as a fallback |
| Hosting | Vercel, with DNS on Cloudflare |
| Tests | Vitest |
| Extras | `qrcode` for UPI QR codes, `canvas-confetti` for celebrations |

## Quick start (no backend needed)

You need **Node.js 20.9 or newer** (the project was built on Node 24).

```bash
git clone https://github.com/josephshinjo-beep/bdap-The-birthday-App.git
cd bdap-The-birthday-App
npm install
npm run dev
```

Open <http://localhost:3000>.

Without Supabase keys the app runs on **sample data**. Use the **Demo** button in the bottom-left corner to switch between:

| Demo user | Try this |
|---|---|
| **Member** (Kabir) | Open Riya's surprise, scratch the card, tick "I've chipped in" |
| **Moderator** (Aarav) | Approve join requests, see who paid, edit the room |
| **Birthday person** (Riya) | Her birthday is today: open the room for the "Your wall is ready" banner, drag notes, read the private ones, try the Instagram card |
| **Class rep** (Ananya) | Room → Expenses: start a split (goes for approval), record who paid |
| **New student** | Go to `/join`, enter code `CSEB26`, fill in the profile and send a request |

**Two-tab demo:** open one tab as the new student waiting for approval and a second tab as the moderator. Click "Let in" in the moderator tab and the first tab moves into the room by itself. Each tab keeps its own demo user. "Reset data" in the demo menu brings back the sample data, which also refreshes every day so "birthday today" stays true.

## Project structure

```
bdap/
├── docs/
│   ├── blueprint.html          Clickable prototype, plan and architecture (open in a browser)
│   └── PLAN_PROMPT.md          The full product brief
├── public/
│   └── sw.js                   Service worker: shows pushes, opens their link on tap
├── src/
│   ├── app/                    Routes (each page.tsx renders a client *-view.tsx in <Suspense>)
│   │   ├── page.tsx            Home
│   │   ├── login/  onboarding/  join/  create/  me/
│   │   ├── rooms/              My rooms, room, waiting, manage, edit, surprise
│   │   ├── auth/callback/      Google OAuth code exchange
│   │   ├── api/cron/reminders/ Reminder job (secret-protected)
│   │   ├── api/push/           Save / remove a device's push subscription
│   │   ├── icons/[size]/       App icons drawn at request time
│   │   └── manifest.ts         PWA manifest
│   ├── components/             UI: header, bell, code input, scratch card, forms…
│   ├── lib/
│   │   ├── types.ts            Shared contracts (Room, Member, Celebration, Surprise, Pool…)
│   │   ├── data/
│   │   │   ├── api.ts          The data-layer interface
│   │   │   ├── index.ts        Picks mock or Supabase
│   │   │   ├── mock.ts         Sample data + demo users
│   │   │   └── supabase.ts     Real calls (RPCs)
│   │   ├── supabase/           Browser, server and service-role clients
│   │   ├── dates.ts            IST date helpers, next birthday, 29 Feb rule
│   │   ├── upi.ts              UPI rotation + upi:// link builder
│   │   ├── push.ts             Web Push sending (server only)
│   │   └── safe-next.ts        Safe post-login redirects
│   ├── styles/
│   │   ├── theme.css           Every colour, font, radius and motion token
│   │   └── fonts.ts            Font families
│   └── proxy.ts                Next.js 16 Proxy: refreshes the session, guards private pages
├── supabase/
│   ├── migrations/             Schema, row level security and RPCs (run in order)
│   └── cron.sql                Schedules the reminder job (run once, by hand)
├── .env.example                Every environment variable, explained
├── vercel.json                 Vercel Cron fallback
└── CONTRIBUTING.md             How the two of us work on this
```

## Architecture

```
 Phone / browser (PWA)
 ┌──────────────────────────────────────────────┐
 │ Pages ──► data layer (src/lib/data)          │
 │             ├─ mock.ts      (no keys)        │
 │             └─ supabase.ts  (RPCs + RLS) ────┼──► Supabase Postgres
 │ Service worker ◄── Web Push                  │       ├─ Auth (Google)
 └──────────────────────────────────────────────┘       ├─ Realtime (approvals, bell)
                                                         └─ Storage (QR images)
 Vercel (Next.js server)
   /auth/callback          exchanges the Google code for a session cookie
   /api/push               stores push subscriptions (after checking the session)
   /api/cron/reminders ◄── pg_cron + pg_net every 15 minutes
        └─ prepare_due_reminders() → notifications → Web Push to each device
```

- **Pages never talk to Supabase directly.** They call `data.*`, which is either the mock or the Supabase implementation. That's how the frontend works without waiting on the backend.
- **The browser uses only the public anon key.** Row level security and SECURITY DEFINER functions decide what each person can see.
- **The service-role key stays on the server**, used only by the cron route and the push route.

## Data model

| Table | Purpose |
|---|---|
| `profiles` | Full name, username, date of birth, avatar. Readable only by its owner. |
| `rooms` | Name, 6-character code, amount mode and amount, payers per UPI ID, reminder switches and times, birthday wish, auto-approve |
| `memberships` | Who is in which room, with role (moderator, co_moderator, member) and status (pending, approved, declined) |
| `room_upi_accounts` | A room's UPI IDs, each with a payee name, owner, optional QR image, order and on/off switch |
| `celebrations` | One per room, birthday person and date: upcoming → live → done, plus the admins' decision (pending, celebrate, wish_only) |
| `contributions` | Which UPI ID each payer was given, and whether they ticked "paid" |
| `notifications` | The in-app feed; one reminder per person, celebration and kind |
| `push_subscriptions` | Each device's Web Push endpoint |
| `polls`, `poll_options`, `poll_votes` | Votes such as the cake flavour; closing sets the celebration's total |
| `expenses`, `expense_payments` | Class expense splits (requested by reps, approved by admins) and who paid |
| `wishes` | Notes on a birthday wall: message, colour, position, and whether it's private |

Room codes use `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, so there's no O/0 or I/1 mix-up.

**Main functions (RPCs):** `username_available`, `preview_room`, `request_join`, `create_room`, `regenerate_room_code`, `decide_request`, `set_member_role`, `remove_member`, `room_members`, `ensure_room_celebrations`, `open_surprise`, `mark_paid`, `celebration_pool`, `celebration_payers`, `set_celebration_decision`, `delete_room`, `set_celebration_details`, `record_celebration_payment`, `create_poll`, `poll_view`, `vote_poll`, `close_poll`, `request_expense`, `decide_expense`, `room_expenses`, `mark_expense_paid`, `expense_payers`, `record_expense_payment`, `room_upi_choices`, `add_wish`, `wall_info`, `wall_wishes`, `move_wish`, `delete_wish`, `my_birthday_walls`, and `prepare_due_reminders` (server only).

## How the secret is kept

- **Row level security is on for every table.**
- **Profiles are private.** Classmates see others only through `room_members()`, which returns the birth day and month, never the year.
- **The birthday person can't see their celebration.** The `celebrations` policy requires `birthday_user_id <> auth.uid()`. `open_surprise`, `mark_paid`, `celebration_pool` and `celebration_payers` refuse them too. Their own surprise link shows a plain "Nothing here" page that gives nothing away.
- **No reminders go to the birthday person**, and the moderator's own birthday is covered too.
- **Members only see approved celebrations.** Until an admin chooses Celebrate, the celebration, surprise page, pool and UPI QR are hidden from members (enforced in the database, not just the app).
- **Anything that affects other people goes through functions**, never direct table writes: approving, roles, codes and UPI assignment. Admins can edit room settings, but the column grants stop them changing the code or owner directly.
- **Only moderators see who paid.** Everyone else sees the total.
- **Safe redirects.** After login you can only be sent to a page on this site.
- **Push addresses are checked.** The server only sends to real browser push services (Google, Mozilla, Apple, Microsoft), never to a URL someone typed in.
- **The cron secret is compared in constant time**, and every response sets security headers.

## UPI rotation

Rooms usually have 2–3 UPI IDs so no single account gets swamped. When someone opens a surprise, `open_surprise()` gives them a UPI ID:

1. Skip UPI IDs that are paused, or that belong to the birthday person.
2. Fill UPI IDs in order until each has `payers_per_upi` people (default 20, set by the moderator).
3. If every one is full, use the least-filled one and alert the moderators to add another.
4. A person gets one UPI ID per celebration and always sees the same QR.

An advisory lock stops two people grabbing the same slot at once. The same rules live in `pickUpiAccount()` in `src/lib/upi.ts` with unit tests: for example, the 21st payer gets the second UPI ID.

The QR encodes `upi://pay?pa=<upi>&pn=<payee>&am=<amount>&cu=INR&tn=<Name> birthday`. If the moderator uploaded a QR image, that image is shown instead.

## Reminders and push notifications

The job runs every 15 minutes. A notification goes out once its day has come and the room's chosen time has passed:

| Notification | Who gets it | When (room default) | Only if |
|---|---|---|---|
| "Celebrate X's birthday?" | Admins (not the birthday person) | As soon as a birthday is 30 days away | Not decided yet |
| "X's birthday is in a week" | Members | 7 days before, 6:00 PM | Approved, switch on |
| "Psst. X's birthday is tomorrow" | Members | Day before, 6:00 PM | Approved, switch on |
| "Today is X's birthday!" | Members | On the day, 7:30 AM | Approved, switch on |
| "It's X's birthday today 🎂" (wish nudge) | Members | On the day, 7:30 AM | **Not** approved |
| "Happy birthday, X! 🎉" | The birthday person | On the day, 7:30 AM | Birthday wish on |

Each run also creates celebrations for the next 30 days (as Celebrate if the room auto-approves) and moves statuses along: upcoming → live on the day → done after. Sending is idempotent (one per person, birthday and kind), so running often never sends twice. Pushes go to every device, and subscriptions the push service says are gone (404/410) are deleted. The same rules live in `dueReminders()` in `src/lib/reminders.ts` with unit tests.

**iPhone:** push works only after **Share → Add to Home Screen**, on iOS 16.4 or newer. The app shows these steps.

### Priority notifications

Birthday reminders (a week before, the day before, on the day), the birthday wish, "your wall is ready" and new approved splits are **priority** notifications.

**What the app does now (web / PWA):**

| Layer | What happens |
|---|---|
| Push service | Sent with `Urgency: high`, so Android and Chrome deliver them straight away instead of batching them while the phone sleeps. Other notifications use normal urgency. |
| On the phone | The service worker shows them with `requireInteraction` (they stay until dismissed), a vibration pattern, a 🎂 in the title, an Open button, and `renotify` so a repeat still alerts. |
| In the app | Unread priority notifications are pinned at the top of the bell, tinted pink with a "Priority" tag. |
| Database | `notifications.priority` is set by the reminder job, so every device and the in-app feed agree. |

**Plan for "real" OS priority** (Android channels, iOS Time Sensitive). A web app can't set these; they need a thin native wrapper:

1. **Android:** wrap the PWA as a Trusted Web Activity (Bubblewrap) or with Capacitor, and add Firebase Cloud Messaging. Create a "Birthday reminders" notification channel with `IMPORTANCE_HIGH` (heads-up banner, sound) and send priority reminders as FCM `priority: high` messages on that channel. Users can then fine-tune the channel in Android settings.
2. **iOS:** a Capacitor build with the Time Sensitive Notifications entitlement, sending APNs pushes with `interruption-level: time-sensitive` so reminders break through Focus modes.
3. **Server:** keep the same `prepare_due_reminders()` job. Add a `device_tokens` table next to `push_subscriptions`, and in the cron route send each notification to Web Push subscribers (as now) and to FCM/APNs tokens with the priority flag.
4. **In-app safety net:** if a priority reminder is still unread 2 hours before the event, send one gentle follow-up (idempotent, one per person and birthday).


## Going live

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the **SQL editor**, run the eleven files in `supabase/migrations/` in name order: `…_init.sql`, `…_hardening.sql`, `…_grants.sql`, `…_fix_upi_regex.sql`, `…_notification_kinds.sql`, `…_admin_controls.sql`, `…_lock_dob.sql`, `…_more_enum_values.sql`, `…_expenses_polls_wall.sql`, `…_push_all_notifications.sql`, then `…_admin_birthday_controls.sql` (or use `supabase db push` with the Supabase CLI). This creates the tables, security rules and functions, turns on Realtime, and creates the `upi-qr` storage bucket.
3. **Authentication → Providers → Google:** turn it on and paste a Google OAuth client ID and secret (from Google Cloud Console → APIs & Services → Credentials). In Google Cloud, add Supabase's callback URL (shown on that Supabase screen) as an authorised redirect URI.
4. **Authentication → URL configuration:** set the Site URL to `https://bdap.surf`, and add these redirect URLs:
   - `https://bdap.surf/auth/callback`
   - `http://localhost:3000/auth/callback`

### 2. Push keys

```bash
npx web-push generate-vapid-keys
```

The public key goes in `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, the private key in `VAPID_PRIVATE_KEY`.

### 3. Vercel

1. Import the GitHub repo in Vercel.
2. Add every variable from [Environment variables](#environment-variables). Put `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY` and `CRON_SECRET` only in Vercel, never in the code or a chat.
3. Deploy.
4. **After changing any variable, redeploy.** `NEXT_PUBLIC_…` values are built into the app, so open Deployments → latest Production deployment → ⋯ → **Redeploy**, with **Use existing Build Cache** unticked (or push a commit to `master`).

### 4. Domain on Cloudflare

1. In Vercel → Project → Domains, add `bdap.surf` (production domain).
2. In Cloudflare DNS, add a `CNAME` record for `bdap.surf` to `cname.vercel-dns.com`, set to **DNS only** (grey cloud) so Vercel can issue the certificate.

### 5. Reminder schedule

1. In Supabase → **Database → Extensions**, turn on `pg_cron` and `pg_net`.
2. Open `supabase/cron.sql`, replace the `CRON_SECRET` placeholder with the same value you set in Vercel, and run it in the SQL editor. It stores the site URL (`https://bdap.surf`) and the secret in Supabase Vault and schedules the job every 15 minutes. (If you ran an older version, unschedule `bdap-evening-reminders` and `bdap-morning-reminders` as the file shows.)
3. `vercel.json` also runs the job twice a day on Vercel Cron as a backup. Double runs are harmless.

The site URL must be the address the site finally loads on, with `https://` and no trailing slash: if `bdap.surf` redirects to `www.bdap.surf` (or the other way round), store the final one. To change a stored value later:

```sql
select vault.update_secret((select id from vault.secrets where name = 'bdap_site_url'), 'https://bdap.surf');
select vault.update_secret((select id from vault.secrets where name = 'bdap_cron_secret'), '<CRON_SECRET>');
```

**Check the job** by running it once by hand, then reading the reply a few seconds later:

```sql
select public.call_reminder_job();
select status_code, content, created from net._http_response order by created desc limit 5;
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
```

| Reply | Meaning |
|---|---|
| `200`, `"push":{"sent":1+,"failed":0}` | Cron, secret and push keys all work |
| `200`, `"notifications":0` | Working, but nothing was due right now |
| `401` | Vault secret doesn't match `CRON_SECRET` in Vercel, or it's under 16 characters |
| `404` or no row | Wrong site URL, or `pg_net` isn't enabled |

**Rehearse a reminder** without waiting:

```bash
curl -X POST "https://bdap.surf/api/cron/reminders" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Add `?at=2026-11-26T18:05:00%2B05:30` to pretend it's another moment (here 6:05 PM IST). The reply lists how many notifications and pushes went out.

### Launch checklist

- [ ] The owner creates a room, 3 friends join, the owner approves 2 and declines 1, and the approved ones land in the room automatically.
- [ ] With a test birthday set to tomorrow and approved with Celebrate, everyone except that person gets the day-before reminder at the room's time and can unwrap the QR.
- [ ] A birthday set to Just wish sends no reminders or collection, and on the day the birthday person gets the wish.
- [ ] The 21st payer is given the second UPI ID.

## Environment variables

Copy `.env.example` to `.env.local` for local work. Leave the Supabase values empty to use sample data.

| Variable | Where | What it is |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Bypasses row level security; used by cron and push only |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | browser + server | Web Push public key |
| `VAPID_PRIVATE_KEY` | **server only** | Web Push private key |
| `VAPID_SUBJECT` | server | `mailto:` address push services can contact |
| `CRON_SECRET` | **server only** | At least 16 random characters (32+ recommended); the same value goes in `supabase/cron.sql` |
| `NEXT_PUBLIC_SITE_URL` | browser + server | Your public URL: `https://bdap.surf` (redeploy after changing it) |
| `NEXT_PUBLIC_DATA_MODE` | optional | Set to `mock` to force sample data even with Supabase keys |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:watch` | Tests in watch mode |

Run `npm run lint`, `npm test` and `npm run build` before every push.

## Testing

Unit tests cover the logic that must never be wrong:

- `src/lib/upi.test.ts`: UPI rotation (order, the 21st payer, skipping the birthday person's UPI ID, paused IDs, all-full fallback) and UPI links.
- `src/lib/dates.test.ts`: India time, next birthday, the 29 Feb rule, countdowns, and that no year is ever shown.
- `src/lib/safe-next.test.ts`: post-login redirects can't leave the site.
- `src/lib/reminders.test.ts`: nothing goes to members before approval, custom times, wish-only days, the birthday wish, and when admins are asked.
- `src/lib/split.test.ts`: equal split rounding, the "never less than your share" rule, the vote winner and tie-break, priority kinds, and the birth-year rule.

The flows themselves are easiest to check in mock mode with the demo users (see [Quick start](#quick-start-no-backend-needed)).

## Changing the look

The app follows the design blueprint (`docs/blueprint.html`): a cream background, plum headings and main buttons with a pink drop shadow, sun/mint/pink accents, Bricolage Grotesque headings, DM Sans text and JetBrains Mono for codes. Like the blueprint, it keeps one bright look even when the phone is in dark mode. Everything visual lives in two files:

- **`src/styles/theme.css`**: colours, pill colours, radii, button shadows and motion timings, as CSS variables. Components only use the Tailwind names mapped from them (`bg-plum`, `text-accent`, `font-display`…), plus shared classes in `src/app/globals.css` (`.btn`, `.btn-secondary`, `.card`, `.pill`, `.label`, `.field`, `.seg`, `.a-h`).
- **`src/styles/fonts.ts`**: the three font families (display, body, mono).

Change the values there and the whole app follows. Animations respect "reduce motion" settings, and tap targets are at least 44px.

## Team workflow

Two people work in parallel: **backend** (database, functions, data layer, auth, cron, push, UPI logic) and **frontend** (pages, components, animations, theme, PWA UI). The frontend builds against the mock data layer, so it never waits for the backend.

- Announce changes to shared types (`src/lib/types.ts`, `src/lib/data/api.ts`) before making them.
- `master` is the working version. Each person works on their own feature branch, with small pull requests merged every few days.

Ownership rules, Next.js 16 notes and security rules are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

Ideas for after launch (the owner picks):

- Photo memories on the birthday wall
- Native app wrapper for OS-level priority notifications (see [Priority notifications](#priority-notifications))
- WhatsApp share of the room code (sharing already falls back to WhatsApp when the phone has no share sheet)
- Custom room themes

## Troubleshooting

| Problem | Fix |
|---|---|
| "permission denied for table …" | Run `supabase/migrations/20261126000000_grants.sql` in the SQL editor. |
| Birthdays don't show up on the admin dashboard, or "function … does not exist" | Run `…_notification_kinds.sql` and then `…_admin_controls.sql` in the SQL editor. |
| "invalid regular expression: invalid repetition count(s)" when creating a room | Run `supabase/migrations/20261126010000_fix_upi_regex.sql` in the SQL editor. |
| Google login goes back to `/login?error=auth` | Check the redirect URLs in Supabase → Authentication → URL configuration, and that the Google provider is on. |
| The app shows demo data in production | `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing in Vercel. Redeploy after adding them. |
| No push on iPhone | Install it first (Share → Add to Home Screen, iOS 16.4+), then turn notifications on from inside the installed app. |
| "Notifications allowed" but nothing arrives | The VAPID keys aren't set on the server. |
| The test push works, but other notifications (join requests, expenses, polls) only show in the bell | Run `supabase/migrations/20261129000000_push_all_notifications.sql` in the SQL editor. It needs `pg_net` and the two Vault secrets from `supabase/cron.sql`. Until then only birthday reminders are pushed. |
| The cron route returns 401 | The `Authorization: Bearer …` value doesn't match `CRON_SECRET`, or the secret is shorter than 16 characters. |
| Reminders never run | Check `select * from cron.job_run_details order by start_time desc limit 10;` and `select * from net._http_response order by created desc limit 10;` in Supabase. |
| Build error about `useSearchParams` or `useParams` | With Cache Components on, these must be read inside a `<Suspense>` boundary. Keep the `page.tsx` + `*-view.tsx` pattern. |
