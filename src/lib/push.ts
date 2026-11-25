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

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
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
          { TTL: 60 * 60 * 12, urgency: "high", timeout: 10_000 },
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
