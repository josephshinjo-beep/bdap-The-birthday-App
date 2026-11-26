// Reminder job. Called every 15 minutes by Supabase pg_cron (+ pg_net) with
// `Authorization: Bearer $CRON_SECRET`. Each room picks its own reminder
// times, so every run sends whatever has become due (see src/lib/reminders.ts
// and prepare_due_reminders()). Running twice never sends twice.
// Vercel Cron (vercel.json) is a once-a-day fallback.
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sendPushes, type StoredSubscription } from "@/lib/push";
import { getAdminSupabase } from "@/lib/supabase/admin";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // ?at=2026-11-26T18:05:00+05:30 rehearses a moment in time (still needs the secret).
  const atParam = request.nextUrl.searchParams.get("at");
  const at = atParam ? new Date(atParam) : new Date();
  if (Number.isNaN(at.getTime())) return NextResponse.json({ error: "bad at" }, { status: 400 });

  const admin = getAdminSupabase();
  const { data, error } = await admin.rpc("prepare_due_reminders", { p_now: at.toISOString() });
  if (error) {
    console.error("prepare_due_reminders failed", error.message);
    return NextResponse.json({ error: "prepare_due_reminders failed" }, { status: 500 });
  }
  const created = (data ?? []) as { notification_id: string; user_id: string; title: string; body: string; url: string }[];

  let push = { sent: 0, failed: 0, gone: 0 };
  if (created.length > 0) {
    const userIds = [...new Set(created.map((n) => n.user_id))];
    const subsByUser = new Map<string, StoredSubscription[]>();
    for (let i = 0; i < userIds.length; i += 200) {
      const { data: subs } = await admin.from("push_subscriptions").select("user_id, endpoint, p256dh, auth").in("user_id", userIds.slice(i, i + 200));
      for (const s of subs ?? []) subsByUser.set(s.user_id, [...(subsByUser.get(s.user_id) ?? []), s]);
    }

    const items = created.flatMap((n) =>
      (subsByUser.get(n.user_id) ?? []).map((sub) => ({ sub, payload: { title: n.title, body: n.body, url: n.url, tag: n.notification_id } })),
    );
    const result = await sendPushes(items);
    push = { sent: result.sent, failed: result.failed, gone: result.gone.length };

    if (result.gone.length) await admin.from("push_subscriptions").delete().in("endpoint", result.gone);
    const ids = created.map((n) => n.notification_id);
    for (let i = 0; i < ids.length; i += 500) {
      await admin.from("notifications").update({ pushed_at: new Date().toISOString() }).in("id", ids.slice(i, i + 500));
    }
  }

  return NextResponse.json({ ok: true, at: at.toISOString(), notifications: created.length, push });
}

export const POST = run;
// Vercel Cron sends GET with the same Authorization header.
export const GET = run;
