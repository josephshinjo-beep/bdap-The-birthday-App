"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { ProfileForm } from "@/components/profile-form";
import { useSession } from "@/components/providers";
import { PushPrompt } from "@/components/push-prompt";
import { Avatar, BackLink, Page } from "@/components/ui";
import { data } from "@/lib/data";
import type { Session } from "@/lib/types";

export function MeView() {
  return <AuthGate>{(s) => <Me session={s} />}</AuthGate>;
}

function Me({ session }: { session: Session }) {
  const router = useRouter();
  const { refresh } = useSession();
  const [saved, setSaved] = useState(false);
  const p = session.profile!;

  return (
    <Page>
      <BackLink href="/rooms">My rooms</BackLink>
      <div className="card flex items-center gap-3">
        <Avatar name={p.fullName} url={p.avatarUrl} size={56} />
        <div className="min-w-0">
          <h1 className="a-h truncate text-[24px]">{p.fullName}</h1>
          <p className="hint truncate">@{p.username}{session.email && <> · {session.email}</>}</p>
        </div>
      </div>

      <section aria-labelledby="notif" className="flex flex-col gap-2">
        <h2 id="notif" className="label">Notifications</h2>
        <PushPrompt variant="settings" />
      </section>

      <section aria-labelledby="profile" className="flex flex-col gap-2">
        <h2 id="profile" className="label">Profile</h2>
        <div>
          <ProfileForm
            initial={{ fullName: p.fullName, username: p.username, dob: p.dob }}
            submitLabel={saved ? "Saved ✓" : "Save changes"}
            onSaved={async () => {
              await refresh();
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
          />
        </div>
      </section>

      <button
        type="button"
        className="btn-secondary mt-2"
        onClick={async () => {
          await data.signOut();
          await refresh();
          router.replace("/");
        }}
      >
        Log out
      </button>
    </Page>
  );
}
