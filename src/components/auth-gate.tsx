"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { Session } from "@/lib/types";
import { useSession } from "./providers";
import { PageLoading } from "./ui";

/**
 * Client-side gate for pages that need a signed-in user with a profile.
 * The proxy already redirects signed-out users in Supabase mode; this also
 * covers mock mode and the "no profile yet" case.
 */
export function AuthGate({ children, needProfile = true }: { children: (session: Session) => ReactNode; needProfile?: boolean }) {
  const { session, loading } = useSession();
  const router = useRouter();
  const path = usePathname();

  const missingProfile = needProfile && session && !session.profile;

  useEffect(() => {
    if (loading) return;
    const here = typeof window !== "undefined" ? path + window.location.search : path;
    if (!session) router.replace(`/login?next=${encodeURIComponent(here)}`);
    else if (missingProfile) router.replace(`/onboarding?next=${encodeURIComponent(here)}`);
  }, [loading, session, missingProfile, router, path]);

  if (loading || !session || missingProfile) return <PageLoading />;
  return <>{children(session)}</>;
}
