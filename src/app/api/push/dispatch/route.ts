// Push notifications as soon as they're created. A trigger on public.notifications
// (supabase/migrations/20261129000000_push_all_notifications.sql) calls this through
// pg_net after each insert, with `Authorization: Bearer $CRON_SECRET`. It pushes
// whatever hasn't been pushed in the last hour; overlapping calls never send twice.
import { NextResponse, type NextRequest } from "next/server";
import { hasCronSecret } from "@/lib/cron-auth";
import { dispatchPendingPushes } from "@/lib/push-dispatch";
import { pushConfigProblem } from "@/lib/push";
import { getAdminSupabase } from "@/lib/supabase/admin";

const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (!hasCronSecret(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Leave rows unclaimed while push can't be sent, so the reminder job's sweep sends them once it's fixed.
  const pushProblem = pushConfigProblem();
  if (pushProblem) return NextResponse.json({ ok: false, pushProblem }, { status: 503 });

  try {
    const result = await dispatchPendingPushes(getAdminSupabase(), new Date(Date.now() - WINDOW_MS));
    if (result === null) return NextResponse.json({ ok: false, error: "run the push_all_notifications migration" }, { status: 501 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("push dispatch failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "dispatch failed" }, { status: 500 });
  }
}
