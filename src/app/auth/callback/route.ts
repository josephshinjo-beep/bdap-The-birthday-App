// Google OAuth returns here with ?code=…; exchange it for a session cookie.
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { getServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data } = await supabase.auth.getUser();
      const { data: profile } = data.user
        ? await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle()
        : { data: null };
      const dest = profile ? next : `/onboarding?next=${encodeURIComponent(next)}`;
      return NextResponse.redirect(new URL(dest, origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=auth", origin));
}
