// Save or remove this device's Web Push subscription for the signed-in user.
// Uses the service role only after the session is verified, so a device that
// switches accounts moves its subscription to the new user.
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedPushEndpoint } from "@/lib/push";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";

const MAX_BODY = 4096;
const MAX_DEVICES = 10;
const B64URL = /^[A-Za-z0-9_-]+=*$/;

async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

async function currentUser() {
  if (!hasSupabase) return null;
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const body = await readJson(request);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.p256dh === "string" ? body.p256dh : "";
  const auth = typeof body?.auth === "string" ? body.auth : "";
  const userAgent = typeof body?.userAgent === "string" ? body.userAgent.slice(0, 200) : null;

  if (endpoint.length > 1000 || !isAllowedPushEndpoint(endpoint)) return NextResponse.json({ error: "unsupported push endpoint" }, { status: 400 });
  if (!B64URL.test(p256dh) || p256dh.length > 200 || !B64URL.test(auth) || auth.length > 100) return NextResponse.json({ error: "bad keys" }, { status: 400 });

  const admin = getAdminSupabase();
  const { error } = await admin
    .from("push_subscriptions")
    .upsert({ user_id: user.id, endpoint, p256dh, auth, user_agent: userAgent }, { onConflict: "endpoint" });
  if (error) {
    console.error("push subscribe failed", error.message);
    return NextResponse.json({ error: "could not save" }, { status: 500 });
  }

  // Keep the newest few devices per person.
  const { data: rows } = await admin.from("push_subscriptions").select("id").eq("user_id", user.id).order("created_at", { ascending: false });
  const extra = (rows ?? []).slice(MAX_DEVICES).map((r) => r.id);
  if (extra.length) await admin.from("push_subscriptions").delete().in("id", extra);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const body = await readJson(request);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  await getAdminSupabase().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
