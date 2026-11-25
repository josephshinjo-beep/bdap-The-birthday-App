# Contributing to bdap

Two people build bdap in parallel: **backend** (database, RPCs, data layer, auth, cron, push, UPI logic) and **frontend** (pages, components, animations, theme, PWA UI).

## Run it

```bash
npm install
cp .env.example .env.local   # leave the Supabase values empty to use mock data
npm run dev                   # http://localhost:3000
```

With no Supabase values the app runs on **mock data** (`src/lib/data/mock.ts`). A "Demo" button in the bottom-left switches between sample users: a member, the moderator, the birthday person (birthday tomorrow) and a new student without a profile. Open two tabs as different users to watch approvals and notifications arrive live. "Reset data" restores the sample data.

## Who owns what

| Area | Owner | Files |
|---|---|---|
| Shared contracts | both, announce changes first | `src/lib/types.ts`, `src/lib/data/api.ts` |
| Theme and look | frontend | `src/styles/theme.css`, `src/styles/fonts.ts`, `src/components/`, `src/app/**/*-view.tsx`, `src/app/globals.css` |
| Mock data | frontend (backend may add cases) | `src/lib/data/mock.ts` |
| Backend | backend | `src/lib/data/supabase.ts`, `src/lib/supabase/`, `supabase/`, `src/app/api/`, `src/app/auth/`, `src/proxy.ts`, `src/lib/push.ts` |
| Pure logic + tests | backend | `src/lib/upi.ts`, `src/lib/dates.ts`, `*.test.ts` |

- Pages only call `data.*` from `@/lib/data`. Never import Supabase in a component.
- The frontend doesn't edit `src/lib/data/supabase.ts`, `src/lib/supabase/` or `supabase/`; the backend doesn't edit components or styling.
- Colours, fonts, radii and motion only come from `theme.css` tokens (`bg-accent`, `text-ink`, `font-display`…). No hex values in components except the fixed ink on bright chips.

## Branches and pull requests

- `master` is the working version. One feature branch per person.
- Small pull requests, merged every few days.
- Before every push: `npm run lint`, `npm test` and `npm run build`.

## Next.js 16 notes

- Middleware is now **Proxy**: `src/proxy.ts`.
- `params`, `searchParams` and `cookies()` are async.
- `cacheComponents` is on: each page is a tiny server `page.tsx` that renders a client `*-view.tsx` inside `<Suspense>`. Reading `useSearchParams()` / `useParams()` outside a Suspense boundary fails the build.
- Docs for this exact version live in `node_modules/next/dist/docs/`.

## Security rules (do not break)

- RLS is on for every table. Other people's data only comes through the SECURITY DEFINER RPCs.
- Never show a birth year to anyone but its owner.
- Celebrations, reminders, the surprise page and the pool are never visible to the birthday person.
- `SUPABASE_SERVICE_ROLE_KEY` is server only (cron route and push). Never prefix it with `NEXT_PUBLIC_`.
