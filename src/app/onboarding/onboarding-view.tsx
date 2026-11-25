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
      <div className="enter flex flex-col gap-2">
        <span className="pill pill-sun self-start">One-time setup</span>
        <h1 className="a-h">Tell your class <em>who you are</em></h1>
        <p className="a-sub">This is how you show up in every room you join.</p>
      </div>
      <div className="enter-2">
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
