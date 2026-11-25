// Reminder job. Called by Supabase pg_cron (+ pg_net) at 6:00 PM IST (slot=evening)
// and 7:30 AM IST (slot=morning), with `Authorization: Bearer $CRON_SECRET`.
// Vercel Cron (vercel.json) is a fallback; running twice is safe because
// prepare_reminders() only returns notifications it newly created.
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { REMINDER_SLOTS, todayIST, type ReminderSlot } from "@/lib/dates";
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

  const slot = request.nextUrl.searchParams.get("slot");
  if (slot !== "evening" && slot !== "morning") return NextResponse.json({ error: "slot must be evening or morning" }, { status: 400 });

  // ?date=YYYY-MM-DD lets you rehearse a day (still needs the secret).
  const dateParam = request.nextUrl.searchParams.get("date");
  if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  const today = dateParam ?? todayIST();

  const admin = getAdminSupabase();
  const created: { notification_id: string; user_id: string; title: string; body: string; url: string; kind: string }[] = [];
  for (const kind of REMINDER_SLOTS[slot as ReminderSlot].kinds) {
    const { data, error } = await admin.rpc("prepare_reminders", { p_today: today, p_kind: kind });
    if (error) {
      console.error("prepare_reminders failed", kind, error.message);
      return NextResponse.json({ error: "prepare_reminders failed" }, { status: 500 });
    }
    for (const row of data ?? []) created.push({ ...row, kind });
  }

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

  return NextResponse.json({ ok: true, slot, date: today, notifications: created.length, push });
}

export const POST = run;
// Vercel Cron sends GET with the same Authorization header.
export const GET = run;
