"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/components/providers";
import { ErrorNote, Page } from "@/components/ui";
import { GiftArt } from "@/components/gift";
import { data, dataMode } from "@/lib/data";
import { DEMO_USERS, setDemoUser, type DemoUserId } from "@/lib/data/mock";
import { safeNext } from "@/lib/safe-next";

export function LoginView() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const router = useRouter();
  const { session, loading } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error") ? "Sign-in didn't finish. Please try again." : null);

  useEffect(() => {
    if (loading || !session) return;
    router.replace(session.profile ? next : `/onboarding?next=${encodeURIComponent(next)}`);
  }, [loading, session, next, router]);

  async function google() {
    setBusy(true);
    setError(null);
    try {
      await data.signInWithGoogle(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start Google sign-in.");
      setBusy(false);
    }
  }

  return (
    <Page narrow>
      <div className="card enter mt-4 flex flex-col items-center gap-1 p-6 text-center">
        <div className="float">
          <GiftArt size={110} />
        </div>
        <h1 className="a-h mt-3">Log in to <span className="hl">bdap</span></h1>
        <p className="a-sub">Use your Google account. No passwords to remember.</p>
        <button type="button" onClick={google} disabled={busy} className="btn-secondary mt-4 w-full">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>
        <ErrorNote>{error}</ErrorNote>
      </div>

      {dataMode === "mock" && (
        <section aria-labelledby="demo" className="card">
          <h2 id="demo" className="label">Demo mode</h2>
          <p className="a-sub mt-1">Supabase isn&apos;t connected yet, so pick a sample user.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {DEMO_USERS.map((u) => (
              <button key={u.id} type="button" className="btn-secondary h-auto flex-col !items-start py-2 text-left" onClick={() => setDemoUser(u.id as DemoUserId)}>
                <span>{u.label}</span>
                <span className="text-xs font-medium text-muted">{u.hint}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </Page>
  );
}
