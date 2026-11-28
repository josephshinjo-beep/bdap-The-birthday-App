// Reminder job. Called every 15 minutes by Supabase pg_cron (+ pg_net) with
// `Authorization: Bearer $CRON_SECRET`. Each room picks its own reminder
// times, so every run sends whatever has become due (see src/lib/reminders.ts
// and prepare_due_reminders()). Running twice never sends twice.
// It also pushes any other notification from the last hour that hasn't been
// pushed yet, as a safety net for /api/push/dispatch.
// Vercel Cron (vercel.json) is a once-a-day fallback.
import { NextResponse, type NextRequest } from "next/server";
import { hasCronSecret } from "@/lib/cron-auth";
import { pushConfigProblem } from "@/lib/push";
import { dispatchPendingPushes, pushNotifications, type DispatchResult, type PendingPush } from "@/lib/push-dispatch";
import { getAdminSupabase } from "@/lib/supabase/admin";

const SWEEP_WINDOW_MS = 60 * 60 * 1000;

async function run(request: NextRequest) {
  if (!hasCronSecret(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
  const created = (data ?? []) as PendingPush[];

  // Reported on every run, so a bad VAPID setting shows up before a reminder is actually due.
  const pushProblem = pushConfigProblem();
  let push: DispatchResult = { notifications: 0, sent: 0, failed: 0, gone: 0 };
  if (pushProblem) {
    if (created.length > 0) console.error("reminders created but not pushed:", pushProblem);
  } else {
    const swept = await dispatchPendingPushes(admin, new Date(Date.now() - SWEEP_WINDOW_MS));
    if (swept) {
      push = swept;
    } else {
      // Before the push_all_notifications migration: push only what this run created.
      push = await pushNotifications(admin, created);
      const ids = created.map((n) => n.notification_id);
      for (let i = 0; i < ids.length; i += 500) {
        await admin.from("notifications").update({ pushed_at: new Date().toISOString() }).in("id", ids.slice(i, i + 500));
      }
    }
  }

  return NextResponse.json({
    ok: true,
    at: at.toISOString(),
    notifications: created.length,
    push: { pushed: push.notifications, sent: push.sent, failed: push.failed, gone: push.gone },
    ...(pushProblem ? { pushProblem } : {}),
  });
}

export const POST = run;
// Vercel Cron sends GET with the same Authorization header.
export const GET = run;
