// k6 load test for the birthday app.
//
// ASSUMED API: this repository has no application code yet, so the endpoints below are a
// placeholder contract (see loadtest/README.md). Update ENDPOINTS once the real API exists.
//
// Usage:
//   k6 run -e PROFILE=smoke  -e BASE_URL=http://localhost:3000 loadtest/birthday-app.k6.js
//   k6 run -e PROFILE=load   -e BASE_URL=https://staging.example.test \
//          -e ALLOWED_HOSTS=staging.example.test loadtest/birthday-app.k6.js
//
// PROFILE: smoke | load | stress | spike   (default: smoke)
// Never point this at production. The guard below refuses any host that is not loopback
// or explicitly listed in ALLOWED_HOSTS, and ALLOWED_HOSTS entries must contain "staging".

import http from 'k6/http';
import { check, group, sleep, fail } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------------------------
// Target guard: localhost or staging only
// ---------------------------------------------------------------------------------------------
const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const m = BASE_URL.match(/^(https?):\/\/(\[[^\]]+\]|[^/:]+)(?::(\d+))?(\/.*)?$/i);
if (!m) fail(`BASE_URL is not a valid http(s) URL: ${BASE_URL}`);
const HOST = m[2].toLowerCase().replace(/^\[|\]$/g, '');
const LOOPBACK = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
const ALLOWED = (__ENV.ALLOWED_HOSTS || '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);
for (const h of ALLOWED) {
  if (!h.includes('staging')) fail(`ALLOWED_HOSTS entry "${h}" does not look like a staging host; refusing.`);
}
if (!LOOPBACK.includes(HOST) && !HOST.endsWith('.localhost') && !ALLOWED.includes(HOST)) {
  fail(`Refusing to load-test "${HOST}". Only loopback hosts or hosts listed in ALLOWED_HOSTS (staging) are permitted.`);
}

// ---------------------------------------------------------------------------------------------
// Assumed endpoints. Edit these to match the real API.
// ---------------------------------------------------------------------------------------------
const ENDPOINTS = {
  health: '/api/health',
  signup: '/api/auth/signup',
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  upcoming: '/api/birthdays?upcoming=30',
  birthdays: '/api/birthdays',
  birthday: (id) => `/api/birthdays/${id}`,
  wishes: '/api/wishes',
};

// Pre-seeded staging/local test accounts (never real users). See users.example.json.
const USERS = new SharedArray('users', () => JSON.parse(open(__ENV.USERS_FILE || './users.example.json')));

// ---------------------------------------------------------------------------------------------
// Profiles. VU counts are starting assumptions: calibrate against expected peak traffic.
// ---------------------------------------------------------------------------------------------
const PROFILES = {
  smoke: {
    stages: [
      { duration: '10s', target: 2 },
      { duration: '2m', target: 2 }, // hold so every flow runs at least once
    ],
    thresholds: {
      http_req_failed: ['rate<0.01'],
      'http_req_duration{kind:read}': ['p(95)<300', 'p(99)<600'],
      'http_req_duration{kind:write}': ['p(95)<500', 'p(99)<1000'],
      checks: ['rate>0.99'],
    },
  },
  load: {
    stages: [
      { duration: '2m', target: 50 }, // ramp to expected normal peak
      { duration: '10m', target: 50 }, // hold
      { duration: '2m', target: 0 }, // ramp down
    ],
    thresholds: {
      http_req_failed: ['rate<0.01'],
      'http_req_duration{kind:read}': ['p(95)<400', 'p(99)<800'],
      'http_req_duration{kind:write}': ['p(95)<700', 'p(99)<1500'],
      checks: ['rate>0.99'],
      rate_limited: ['count<1'], // test accounts should not hit limits at normal load
    },
  },
  stress: {
    stages: [
      { duration: '2m', target: 50 },
      { duration: '5m', target: 100 },
      { duration: '5m', target: 200 },
      { duration: '5m', target: 300 }, // beyond expected capacity: find the knee
      { duration: '3m', target: 0 }, // recovery
    ],
    thresholds: {
      // Looser: the goal is to find where it degrades, not to pass.
      http_req_failed: ['rate<0.05'],
      'http_req_duration{kind:read}': ['p(95)<1000', 'p(99)<2500'],
      'http_req_duration{kind:write}': ['p(95)<1500', 'p(99)<3000'],
    },
  },
  spike: {
    stages: [
      { duration: '1m', target: 10 }, // baseline
      { duration: '20s', target: 300 }, // sudden surge (e.g. a shared invite link)
      { duration: '2m', target: 300 },
      { duration: '20s', target: 10 }, // drop back
      { duration: '3m', target: 10 }, // must recover to baseline latency
      { duration: '30s', target: 0 },
    ],
    thresholds: {
      http_req_failed: ['rate<0.05'],
      'http_req_duration{kind:read}': ['p(95)<1500', 'p(99)<3000'],
      'http_req_duration{kind:write}': ['p(95)<2000', 'p(99)<4000'],
    },
  },
};

const PROFILE = (__ENV.PROFILE || 'smoke').toLowerCase();
if (!PROFILES[PROFILE]) fail(`Unknown PROFILE "${PROFILE}". Use smoke, load, stress or spike.`);

export const options = {
  scenarios: {
    users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: PROFILES[PROFILE].stages,
      gracefulRampDown: '30s',
    },
  },
  thresholds: PROFILES[PROFILE].thresholds,
  // k6's default: only 2xx/3xx count as success, so 401/403/429/5xx all raise http_req_failed.
  userAgent: 'bdap-k6-loadtest/1.0',
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// ---------------------------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------------------------
const rateLimited = new Counter('rate_limited');
const loginFailed = new Rate('login_failed');
const flowDuration = new Trend('flow_duration', true);

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const think = (min = 2, max = 6) => sleep(min + Math.random() * (max - min)); // human pacing

function track(res, name) {
  if (res.status === 429) rateLimited.add(1, { endpoint: name });
  return res;
}

function req(method, path, body, token, kind, name) {
  const params = {
    headers: token ? { ...JSON_HEADERS, Authorization: `Bearer ${token}` } : JSON_HEADERS,
    tags: { kind, name },
  };
  const payload = body === null || body === undefined ? null : JSON.stringify(body);
  return track(http.request(method, `${BASE_URL}${path}`, payload, params), name);
}

function login(user) {
  const res = req('POST', ENDPOINTS.login, { email: user.email, password: user.password }, null, 'write', 'login');
  const ok = check(res, { 'login 200': (r) => r.status === 200, 'login returns token': (r) => !!jsonField(r, 'token') });
  loginFailed.add(!ok);
  return ok ? jsonField(res, 'token') : null;
}

function jsonField(res, field) {
  try {
    return res.json(field);
  } catch (_) {
    return undefined;
  }
}

function pickUser() {
  return USERS[(__VU + __ITER) % USERS.length];
}

function randomDate() {
  const d = new Date(Date.UTC(1960 + Math.floor(Math.random() * 50), Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28)));
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------------------------
// User flows (weighted)
// ---------------------------------------------------------------------------------------------

// 60%: open app, check upcoming birthdays, open one
function browseUpcoming() {
  const token = login(pickUser());
  if (!token) return;
  think(1, 3);
  group('browse upcoming', () => {
    const list = req('GET', ENDPOINTS.upcoming, null, token, 'read', 'upcoming');
    check(list, { 'upcoming 200': (r) => r.status === 200 });
    think(3, 8); // user reads the list
    const items = jsonField(list, 'items') || [];
    if (items.length) {
      const id = items[Math.floor(Math.random() * items.length)].id;
      check(req('GET', ENDPOINTS.birthday(id), null, token, 'read', 'birthday_detail'), {
        'detail 200': (r) => r.status === 200,
      });
      think(2, 5);
    }
  });
}

// 25%: add a birthday, edit it, then remove it (cleanup keeps staging data stable)
function manageBirthday() {
  const token = login(pickUser());
  if (!token) return;
  think(1, 3);
  group('manage birthday', () => {
    const created = req('POST', ENDPOINTS.birthdays, { name: `k6 friend ${__VU}-${__ITER}`, date: randomDate(), notes: 'load test' }, token, 'write', 'create_birthday');
    check(created, { 'create 201': (r) => r.status === 201 });
    const id = jsonField(created, 'id');
    think(3, 7); // user fills in details
    if (id) {
      check(req('PATCH', ENDPOINTS.birthday(id), { notes: 'likes chocolate cake' }, token, 'write', 'update_birthday'), {
        'update 200': (r) => r.status === 200,
      });
      think(2, 4);
      check(req('GET', ENDPOINTS.birthdays, null, token, 'read', 'list_birthdays'), { 'list 200': (r) => r.status === 200 });
      think(2, 4);
      check(req('DELETE', ENDPOINTS.birthday(id), null, token, 'write', 'delete_birthday'), {
        'delete 2xx': (r) => r.status === 200 || r.status === 204,
      });
    }
  });
}

// 10%: send a birthday wish
function sendWish() {
  const token = login(pickUser());
  if (!token) return;
  think(1, 3);
  group('send wish', () => {
    const list = req('GET', ENDPOINTS.upcoming, null, token, 'read', 'upcoming');
    const items = jsonField(list, 'items') || [];
    think(3, 6);
    if (items.length) {
      const res = req('POST', ENDPOINTS.wishes, { birthdayId: items[0].id, message: 'Happy birthday! 🎉' }, token, 'write', 'send_wish');
      check(res, { 'wish 201': (r) => r.status === 201 });
      think(2, 4);
    }
  });
}

// 5%: new user signs up (unique, clearly fake address on a reserved domain)
function signUp() {
  group('sign up', () => {
    const email = `k6+${__VU}-${__ITER}-${Date.now()}@example.test`;
    think(5, 12); // filling in the form
    const res = req('POST', ENDPOINTS.signup, { email, password: `k6-${Math.random().toString(36).slice(2)}A1!`, name: 'k6 user' }, null, 'write', 'signup');
    check(res, { 'signup 201': (r) => r.status === 201 });
  });
}

const FLOWS = [
  [0.6, browseUpcoming],
  [0.25, manageBirthday],
  [0.1, sendWish],
  [0.05, signUp],
];

export function setup() {
  const res = http.get(`${BASE_URL}${ENDPOINTS.health}`, { tags: { kind: 'read', name: 'health' } });
  if (res.status !== 200) fail(`Health check failed at ${BASE_URL}${ENDPOINTS.health} (status ${res.status}). Is the app running?`);
}

export default function () {
  const start = Date.now();
  let r = Math.random();
  for (const [w, flow] of FLOWS) {
    if ((r -= w) <= 0) {
      flow();
      break;
    }
  }
  flowDuration.add(Date.now() - start);
  think(5, 15); // pause before the next session
}
