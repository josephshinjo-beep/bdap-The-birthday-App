"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { AuthGate } from "@/components/auth-gate";
import { ProfileForm } from "@/components/profile-form";
import { useSession } from "@/components/providers";
import { Page } from "@/components/ui";
import { safeNext } from "@/lib/safe-next";
import type { Session } from "@/lib/types";

export function OnboardingView() {
  return <AuthGate needProfile={false}>{(session) => <Onboarding session={session} />}</AuthGate>;
}

function Onboarding({ session }: { session: Session }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { refresh } = useSession();

  useEffect(() => {
    if (session.profile) router.replace(next);
  }, [session.profile, next, router]);

  return (
    <Page narrow>
      <div className="enter mt-4">
        <p className="chip">One-time setup</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold">Tell your class who you are</h1>
        <p className="mt-1 text-muted">This is how you show up in every room you join.</p>
      </div>
      <div className="card enter-2 mt-6 p-5 sm:p-6">
        <ProfileForm
          initial={{ fullName: session.suggestedName ?? "" }}
          submitLabel="Save and continue"
          onSaved={async () => {
            await refresh();
            router.replace(next);
          }}
        />
      </div>
    </Page>
  );
}
