// Send a test push to one of the signed-in user's own devices, so they can
// check that notifications reach this phone or browser. It only ever looks up
// subscriptions that belong to the caller, so it can't be used to message anyone else.
import { NextResponse, type NextRequest } from "next/server";
import { isPushConfigured, sendPushes } from "@/lib/push";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";

const MAX_BODY = 2048;
const COOLDOWN_MS = 15_000;
// Best effort: per server instance only, which is enough to stop accidental double taps.
const lastSent = new Map<string, number>();

export async function POST(request: NextRequest) {
  if (!hasSupabase) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  if (!isPushConfigured()) {
    return NextResponse.json({ error: "push is not configured on the server", code: "not_configured" }, { status: 503 });
  }

  const text = await request.text();
  if (text.length > MAX_BODY) return NextResponse.json({ error: "bad request" }, { status: 400 });
  let endpoint = "";
  try {
    const body = JSON.parse(text || "{}");
    endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!endpoint || endpoint.length > 1000) return NextResponse.json({ error: "endpoint required" }, { status: 400 });

  const now = Date.now();
  if (now - (lastSent.get(user.id) ?? 0) < COOLDOWN_MS) {
    return NextResponse.json({ error: "please wait a few seconds", code: "rate_limited" }, { status: 429 });
  }

  const admin = getAdminSupabase();
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);
  if (error) {
    console.error("push test lookup failed", error.message);
    return NextResponse.json({ error: "could not look up this device" }, { status: 500 });
  }
  // Only an actual send starts the cooldown, so the client can re-register and retry at once.
  if (subs?.length) {
    if (lastSent.size > 5000) lastSent.clear();
    lastSent.set(user.id, now);
  }

  const result = await sendPushes(
    (subs ?? []).map((sub) => ({
      sub,
      payload: {
        title: "Test notification",
        body: "Push notifications are working on this device. 🎉",
        url: "/me",
        tag: "bdap-test",
      },
    })),
  );
  if (result.gone.length) await admin.from("push_subscriptions").delete().in("endpoint", result.gone);

  return NextResponse.json({ devices: subs?.length ?? 0, sent: result.sent, failed: result.failed, gone: result.gone.length });
}
