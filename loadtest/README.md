# Load-test plan: birthday app

Script: [`birthday-app.k6.js`](./birthday-app.k6.js). Requires [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) v1.x.

> **Status:** the repository has no application code yet, so the endpoints are an **assumed contract**
> (table below). Edit `ENDPOINTS` in the script once the real API exists, then re-check the flows.
> The script has only been run against a local mock to prove it executes; there is **no performance
> baseline for the app yet**.

## Safety: localhost or staging only

The script refuses to start unless `BASE_URL`'s host is loopback (`localhost`, `127.0.0.1`, `::1`,
`*.localhost`) or is listed in `ALLOWED_HOSTS`, and every `ALLOWED_HOSTS` entry must contain
`staging`. Never run it against production, and don't use `--out cloud` without agreeing it first.

```bash
k6 run -e PROFILE=smoke -e BASE_URL=http://localhost:3000 loadtest/birthday-app.k6.js
```

```bash
k6 run -e PROFILE=load -e BASE_URL=https://staging.bdap.example -e ALLOWED_HOSTS=staging.bdap.example -e USERS_FILE=./users.staging.json loadtest/birthday-app.k6.js
```

Before running on staging:

- Seed test accounts (`users.example.json` shows the format); keep real credentials out of git.
- Tell whoever owns staging, and make sure alerting/autoscaling there is expected to fire.
- Either exempt the k6 accounts from per-user rate limits or spread load over enough accounts.
  Otherwise `429`s will dominate. They are counted separately in the `rate_limited` metric.
- `manageBirthday` deletes what it creates; `signUp` creates `k6+…@example.test` users that need
  periodic cleanup.

## Assumed API

| Endpoint | Method | Used by |
|---|---|---|
| `/api/health` | GET | setup (aborts if not 200) |
| `/api/auth/login` | POST → `{token}` | every flow except sign-up |
| `/api/auth/signup` | POST → 201 | sign-up |
| `/api/birthdays?upcoming=30` | GET → `{items:[{id,…}]}` | browse, send wish |
| `/api/birthdays` | GET / POST → 201 `{id}` | manage |
| `/api/birthdays/:id` | GET / PATCH / DELETE | browse, manage |
| `/api/wishes` | POST → 201 | send wish |

## User flows and think time

Each VU iteration picks one session by weight, then pauses 5 to 15 s before the next one.

| Flow | Weight | Steps (think time between steps) |
|---|---|---|
| Browse upcoming | 60% | login → 1–3 s → upcoming list → 3–8 s (reading) → open one → 2–5 s |
| Manage a birthday | 25% | login → 1–3 s → create → 3–7 s (typing) → edit → 2–4 s → list → 2–4 s → delete |
| Send a wish | 10% | login → 1–3 s → upcoming → 3–6 s → post wish → 2–4 s |
| Sign up | 5% | 5–12 s (filling in the form) → sign up |

Requests are tagged `kind:read` or `kind:write` so the two get separate latency targets.

## Profiles and targets

VU counts are starting assumptions. Set the `load` peak to your expected busiest hour of
concurrent users, then scale the others from it.

| Profile | Shape | Read p95 / p99 | Write p95 / p99 | Error rate | Purpose |
|---|---|---|---|---|---|
| `smoke` | 2 VUs, 2 min | < 300 / 600 ms | < 500 / 1000 ms | < 1%, checks > 99% | Script and deploy sanity; run on every staging deploy |
| `load` | 0→50 in 2 min, hold 10 min, ramp down 2 min | < 400 / 800 ms | < 700 / 1500 ms | < 1%, zero 429s | Expected peak traffic must meet the SLO |
| `stress` | 50→100→200→300, 5 min each, 3 min recovery | < 1000 / 2500 ms | < 1500 / 3000 ms | < 5% | Find the knee where latency or errors climb; note the VU count |
| `spike` | 10 → 300 in 20 s, hold 2 min, back to 10, 3 min recovery | < 1500 / 3000 ms | < 2000 / 4000 ms | < 5% | Surge from a shared invite link; latency must return to baseline after the spike |

A failed threshold makes k6 exit non-zero, so the `smoke` and `load` profiles can gate CI against
staging. `stress` and `spike` are exploratory: record where they break rather than requiring a pass.

## What to record per run

- p95/p99 per `kind` and per `name` tag (`k6 run --summary-export=summary.json …`).
- `http_req_failed`, `rate_limited`, `login_failed`.
- For `stress`: the VU level where p95 first crosses the `load` target, and the first error type.
- For `spike`: time for p95 to return to within 20% of the pre-spike level.
- Server-side CPU, memory, DB connections and slow-query log for the same window.
