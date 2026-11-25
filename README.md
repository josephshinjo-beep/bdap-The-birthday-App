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
3. **A secret heads-up.** At 6:00 PM the day before a birthday, everyone in the room gets a reminder. Everyone except the birthday person.
4. **Chip in with UPI.** Tap the gift three times, scratch the card, and pay from any UPI app. Everyone watches the pool fill up.

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
| Moderator dashboard | `/rooms/[id]/manage` | Code ticket with copy and share, join requests (Let in / Decline), members, co-moderators, remove, view as member |
| Edit room | `/rooms/[id]/manage/edit` | All settings, manage and pause UPI IDs, co-moderators, "Make a new code" |
| Profile | `/me` | Edit profile, turn push notifications on or off, log out |

### Secret reminders and UPI (Milestone 2)

- **Surprise page** (`/rooms/[id]/surprise/[celebrationId]`): tap the gift 3 times (shake and confetti), scratch the card, and get the UPI QR, UPI ID, payee and amount. A "Pay with a UPI app" button opens GPay, PhonePe, Paytm or a bank app. "Reveal without scratching" is there for keyboards, screen readers and anyone who'd rather not drag.
- **"I've chipped in"** tick. It's self-reported, because UPI doesn't tell the app about payments (that would need a payment gateway).
- **Pool**: everyone sees "10 of 21 chipped in · ₹650". Moderators also see who paid.
- **Notification bell** with an unread count and a live feed.
- **Web Push** reminders, with "Add to Home Screen" steps for iPhone.
- **Scheduled job** at 6:00 PM and 7:30 AM IST.

### Rules the app follows

- Only the day and month of a birthday are shown to others, never the year.
- 29 February birthdays are celebrated on 28 February in non-leap years.
- All dates use India time (Asia/Kolkata), whatever the phone's time zone.
- Amount mode is set per room: **fixed** (everyone pays the same), **suggested** (a nudge) or **any amount**.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, TypeScript, Cache Components) |
| Styling | Tailwind CSS v4, with every colour and font in one theme file |
| Backend | [Supabase](https://supabase.com): Postgres, Auth (Google), Realtime, Storage |
| Notifications | Web Push (VAPID) through a service worker |
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
| **Birthday person** (Riya) | Her birthday is tomorrow: her room shows nothing about it |
| **New student** | Go to `/join`, enter code `CSEB26`, fill in the profile and send a request |

**Two-tab demo:** open one tab as the new student waiting for approval and a second tab as the moderator. Click "Let in" in the moderator tab and the first tab moves into the room by itself. Each tab keeps its own demo user. "Reset data" in the demo menu brings back the sample data, which also refreshes every day so "birthday tomorrow" stays true.

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
   /api/cron/reminders ◄── pg_cron + pg_net at 6:00 PM and 7:30 AM IST
        └─ prepare_reminders() → notifications → Web Push to each device
```

- **Pages never talk to Supabase directly.** They call `data.*`, which is either the mock or the Supabase implementation. That's how the frontend works without waiting on the backend.
- **The browser uses only the public anon key.** Row level security and SECURITY DEFINER functions decide what each person can see.
- **The service-role key stays on the server**, used only by the cron route and the push route.

## Data model

| Table | Purpose |
|---|---|
| `profiles` | Full name, username, date of birth, avatar. Readable only by its owner. |
| `rooms` | Name, 6-character code, amount mode and amount, payers per UPI ID, reminder switches |
| `memberships` | Who is in which room, with role (moderator, co_moderator, member) and status (pending, approved, declined) |
| `room_upi_accounts` | A room's UPI IDs, each with a payee name, owner, optional QR image, order and on/off switch |
| `celebrations` | One per room, birthday person and date: upcoming → live → done |
| `contributions` | Which UPI ID each payer was given, and whether they ticked "paid" |
| `notifications` | The in-app feed; one reminder per person, celebration and kind |
| `push_subscriptions` | Each device's Web Push endpoint |

Room codes use `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, so there's no O/0 or I/1 mix-up.

**Main functions (RPCs):** `username_available`, `preview_room`, `request_join`, `create_room`, `regenerate_room_code`, `decide_request`, `set_member_role`, `remove_member`, `room_members`, `ensure_room_celebrations`, `open_surprise`, `mark_paid`, `celebration_pool`, `celebration_payers`, and `prepare_reminders` (server only).

## How the secret is kept

- **Row level security is on for every table.**
- **Profiles are private.** Classmates see others only through `room_members()`, which returns the birth day and month, never the year.
- **The birthday person can't see their celebration.** The `celebrations` policy requires `birthday_user_id <> auth.uid()`. `open_surprise`, `mark_paid`, `celebration_pool` and `celebration_payers` refuse them too. Their own surprise link shows a plain "Nothing here" page that gives nothing away.
- **No reminders go to the birthday person**, and the moderator's own birthday is covered too.
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

| Slot | Time (IST) | Sends |
|---|---|---|
| `evening` | 6:00 PM | "A week to go" (if switched on) and "Tomorrow" |
| `morning` | 7:30 AM | "Today!" |

Each run:

1. Creates celebrations for birthdays in the next 7 days.
2. Moves statuses along: upcoming → live on the day → done after.
3. Adds a reminder for every approved member except the birthday person. This is idempotent, so running twice never sends twice.
4. Sends Web Push to their devices, and deletes subscriptions the push service says are gone (404/410).

**iPhone:** push works only after **Share → Add to Home Screen**, on iOS 16.4 or newer. The app shows these steps.

## Going live

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the **SQL editor**, run the files in `supabase/migrations/` in order (or use `supabase db push` with the Supabase CLI). This creates the tables, security rules and functions, turns on Realtime, and creates the `upi-qr` storage bucket.
3. **Authentication → Providers → Google:** turn it on and paste a Google OAuth client ID and secret (from Google Cloud Console → APIs & Services → Credentials). In Google Cloud, add Supabase's callback URL (shown on that Supabase screen) as an authorised redirect URI.
4. **Authentication → URL configuration:** set the Site URL to your domain, and add these redirect URLs:
   - `https://<your-domain>/auth/callback`
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

### 4. Domain on Cloudflare

1. In Vercel → Project → Domains, add your subdomain (for example `bdap.example.com`).
2. In Cloudflare DNS, add a `CNAME` record from that subdomain to `cname.vercel-dns.com`, set to **DNS only** (grey cloud) so Vercel can issue the certificate.

### 5. Reminder schedule

1. In Supabase → **Database → Extensions**, turn on `pg_cron` and `pg_net`.
2. Open `supabase/cron.sql`, replace the site URL and secret placeholders, and run it in the SQL editor.
3. `vercel.json` schedules the same two jobs on Vercel Cron as a backup. Its free tier is only accurate to the hour, but double runs are harmless.

**Rehearse a reminder** without waiting for 6 PM:

```bash
curl -X POST "https://<your-domain>/api/cron/reminders?slot=evening" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Add `&date=YYYY-MM-DD` to pretend it's another day. The reply lists how many notifications and pushes went out.

### Launch checklist

- [ ] The owner creates a room, 3 friends join, the owner approves 2 and declines 1, and the approved ones land in the room automatically.
- [ ] With a test birthday set to tomorrow, everyone except that person gets the 6 PM reminder and can unwrap the QR.
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
| `NEXT_PUBLIC_SITE_URL` | browser + server | Your public URL, e.g. `https://bdap.example.com` |
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

- A secret wish wall that is revealed at midnight
- A gift poll
- A reveal page for the birthday person on the day
- Photo memories
- WhatsApp share of the room code (sharing already falls back to WhatsApp when the phone has no share sheet)
- Custom room themes

## Troubleshooting

| Problem | Fix |
|---|---|
| Google login goes back to `/login?error=auth` | Check the redirect URLs in Supabase → Authentication → URL configuration, and that the Google provider is on. |
| The app shows demo data in production | `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing in Vercel. Redeploy after adding them. |
| No push on iPhone | Install it first (Share → Add to Home Screen, iOS 16.4+), then turn notifications on from inside the installed app. |
| "Notifications allowed" but nothing arrives | The VAPID keys aren't set on the server. |
| The cron route returns 401 | The `Authorization: Bearer …` value doesn't match `CRON_SECRET`, or the secret is shorter than 16 characters. |
| Reminders never run | Check `select * from cron.job_run_details order by start_time desc limit 10;` and `select * from net._http_response order by created desc limit 10;` in Supabase. |
| Build error about `useSearchParams` or `useParams` | With Cache Components on, these must be read inside a `<Suspense>` boundary. Keep the `page.tsx` + `*-view.tsx` pattern. |
