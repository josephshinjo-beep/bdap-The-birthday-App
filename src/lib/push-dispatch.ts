import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushes, type PushPayload, type StoredSubscription } from "@/lib/push";

/** A notification row to deliver as a push. */
export interface PendingPush {
  notification_id: string;
  user_id: string;
  title: string;
  body: string;
  url: string;
  priority: boolean;
}

export interface DispatchResult {
  notifications: number;
  sent: number;
  failed: number;
  gone: number;
}

const CLAIM_LIMIT = 500;
const MAX_ROUNDS = 5;

/** Push the given notifications to every device their recipients have registered. */
export async function pushNotifications(admin: SupabaseClient, rows: PendingPush[]): Promise<DispatchResult> {
  const result: DispatchResult = { notifications: rows.length, sent: 0, failed: 0, gone: 0 };
  if (rows.length === 0) return result;

  const userIds = [...new Set(rows.map((n) => n.user_id))];
  const subsByUser = new Map<string, StoredSubscription[]>();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data: subs } = await admin.from("push_subscriptions").select("user_id, endpoint, p256dh, auth").in("user_id", userIds.slice(i, i + 200));
    for (const s of subs ?? []) subsByUser.set(s.user_id, [...(subsByUser.get(s.user_id) ?? []), s]);
  }

  const items = rows.flatMap((n) =>
    (subsByUser.get(n.user_id) ?? []).map((sub) => ({
      sub,
      payload: { title: n.title, body: n.body, url: n.url, tag: n.notification_id, priority: n.priority } satisfies PushPayload,
    })),
  );
  const sent = await sendPushes(items);
  if (sent.gone.length) await admin.from("push_subscriptions").delete().in("endpoint", sent.gone);
  return { ...result, sent: sent.sent, failed: sent.failed, gone: sent.gone.length };
}

/**
 * Claim every notification created since `since` that hasn't been pushed yet and push it.
 * Claiming marks the rows first (SKIP LOCKED), so overlapping runs never send one twice.
 * Returns null when the database doesn't have claim_unpushed_notifications() yet.
 */
export async function dispatchPendingPushes(admin: SupabaseClient, since: Date): Promise<DispatchResult | null> {
  const total: DispatchResult = { notifications: 0, sent: 0, failed: 0, gone: 0 };
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { data, error } = await admin.rpc("claim_unpushed_notifications", { p_since: since.toISOString(), p_limit: CLAIM_LIMIT });
    if (error) {
      // PGRST202: function not found (the migration hasn't been run yet).
      if (error.code === "PGRST202" || /claim_unpushed_notifications/.test(error.message)) return round === 0 ? null : total;
      throw new Error(`claim_unpushed_notifications failed: ${error.message}`);
    }
    const rows = (data ?? []) as PendingPush[];
    const r = await pushNotifications(admin, rows);
    total.notifications += r.notifications;
    total.sent += r.sent;
    total.failed += r.failed;
    total.gone += r.gone;
    if (rows.length < CLAIM_LIMIT) break;
  }
  return total;
}
