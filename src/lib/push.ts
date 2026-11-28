import "server-only";
import webpush from "web-push";

// Browser push services. Subscriptions pointing anywhere else are rejected, so
// the server never POSTs to an arbitrary URL a user registered (SSRF).
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/,
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

/** Env values pasted into a dashboard often carry stray whitespace or quotes. */
export function cleanEnv(value: string | undefined): string {
  return (value ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
}

let configured = false;
let problem: string | null = null;

function configure(): boolean {
  if (configured) return true;
  const pub = cleanEnv(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const priv = cleanEnv(process.env.VAPID_PRIVATE_KEY);
  let subject = cleanEnv(process.env.VAPID_SUBJECT) || "mailto:admin@example.com";
  // A bare email address is the most common mistake; web-push needs mailto: or https:.
  if (/^[^\s:@]+@[^\s@]+$/.test(subject)) subject = `mailto:${subject}`;
  if (!pub || !priv) {
    problem = !pub ? "NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set in Vercel." : "VAPID_PRIVATE_KEY is not set in Vercel.";
    return false;
  }
  try {
    webpush.setVapidDetails(subject, pub, priv);
  } catch (err) {
    problem = describeVapidError(err);
    console.error("web-push VAPID settings rejected:", problem);
    return false;
  }
  configured = true;
  problem = null;
  return true;
}

// web-push's messages can echo the subject, so map them to a description that names the
// setting without repeating its value.
function describeVapidError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/subject/i.test(msg)) return "VAPID_SUBJECT must be like mailto:you@example.com or an https:// address.";
  if (/public key/i.test(msg)) return "NEXT_PUBLIC_VAPID_PUBLIC_KEY isn't a valid VAPID public key. Copy the public key from `npx web-push generate-vapid-keys` again.";
  if (/private key/i.test(msg)) return "VAPID_PRIVATE_KEY isn't a valid VAPID private key. Copy the private key from the same key pair again.";
  return "The VAPID settings in Vercel were rejected.";
}

/** True when both VAPID keys are set and valid on the server, so pushes can actually be sent. */
export function isPushConfigured(): boolean {
  return configure();
}

/** Why push can't be sent, naming the setting to fix (never its value); null when it can. */
export function pushConfigProblem(): string | null {
  return configure() ? null : problem;
}

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  /** Birthday reminders: high urgency, stays on screen, vibrates. */
  priority?: boolean;
}

export interface PushResult {
  sent: number;
  failed: number;
  /** Endpoints the push service says are gone (404/410): delete them. */
  gone: string[];
}

export async function sendPushes(items: { sub: StoredSubscription; payload: PushPayload }[]): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, gone: [] };
  if (!configure() || items.length === 0) return result;

  const queue = items.filter((i) => isAllowedPushEndpoint(i.sub.endpoint));
  // Small concurrency so a big room doesn't open hundreds of sockets at once.
  const workers = Array.from({ length: Math.min(10, queue.length) }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        await webpush.sendNotification(
          { endpoint: item.sub.endpoint, keys: { p256dh: item.sub.p256dh, auth: item.sub.auth } },
          JSON.stringify(item.payload),
          // Priority pushes are delivered right away even to sleeping phones; others may be batched.
          { TTL: 60 * 60 * 12, urgency: item.payload.priority ? "high" : "normal", timeout: 10_000 },
        );
        result.sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) result.gone.push(item.sub.endpoint);
        else result.failed++;
      }
    }
  });
  await Promise.all(workers);
  return result;
}
