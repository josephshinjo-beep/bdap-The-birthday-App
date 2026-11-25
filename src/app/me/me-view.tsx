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
    <Page narrow>
      <BackLink href="/rooms">My rooms</BackLink>
      <div className="flex items-center gap-4">
        <Avatar name={p.fullName} url={p.avatarUrl} size={64} />
        <div>
          <h1 className="font-display text-3xl font-extrabold">{p.fullName}</h1>
          <p className="text-muted">@{p.username}{session.email && <> · {session.email}</>}</p>
        </div>
      </div>

      <section aria-labelledby="notif" className="mt-8">
        <h2 id="notif" className="mb-2 font-display text-xl font-bold">Notifications</h2>
        <PushPrompt variant="settings" />
      </section>

      <section aria-labelledby="profile" className="mt-8">
        <h2 id="profile" className="mb-2 font-display text-xl font-bold">Profile</h2>
        <div className="card p-5">
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
        className="btn-ghost mt-8 w-full"
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
