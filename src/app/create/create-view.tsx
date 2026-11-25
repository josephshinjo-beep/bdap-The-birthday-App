"use client";
import Link from "next/link";
import { useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { CodeTicket } from "@/components/code-ticket";
import { DEFAULT_SETTINGS, RoomSettingsFields, UpiFields, settingsValid, upiDraftValid, type UpiDraft } from "@/components/room-settings";
import { BackLink, ErrorNote, Page } from "@/components/ui";
import { data } from "@/lib/data";
import { celebrate } from "@/lib/confetti";
import type { RoomSettingsInput, Session } from "@/lib/types";

export function CreateView() {
  return <AuthGate>{(s) => <Create session={s} />}</AuthGate>;
}

let keySeq = 0;
const blankUpi = (owner: string | null, payee = ""): UpiDraft => ({ key: `u${++keySeq}`, upiId: "", payeeName: payee, ownerUserId: owner, qrImageUrl: null });

function Create({ session }: { session: Session }) {
  const me = session.profile!;
  const [settings, setSettings] = useState<RoomSettingsInput>(DEFAULT_SETTINGS);
  const [upis, setUpis] = useState<UpiDraft[]>(() => [blankUpi(me.id, me.fullName)]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ roomId: string; code: string } | null>(null);

  // At creation the only member is you; link classmates' UPI IDs from Edit room later.
  const owners = [
    { id: me.id as string | null, label: `Me (${me.fullName})` },
    { id: null, label: "Someone else (link them later)" },
  ];
  const upisOk = upis.length > 0 && upis.every(upiDraftValid);
  const canSubmit = settingsValid(settings) && upisOk && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const r = await data.createRoom({ ...settings, upiAccounts: upis.map(({ upiId, payeeName, ownerUserId, qrImageUrl }) => ({ upiId, payeeName, ownerUserId, qrImageUrl })) });
      setCreated(r);
      celebrate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the room.");
      setSaving(false);
    }
  }

  if (created) {
    return (
      <Page>
        <h1 className="a-h pop-in mt-2">
          <em>{settings.name}</em> is ready 🎉
        </h1>
        <p className="a-sub">Share this code in your class group. You let people in from the dashboard.</p>
        <CodeTicket code={created.code} roomName={settings.name} />
        <Link href={`/rooms/${created.roomId}/manage`} className="btn">
          Open the dashboard
        </Link>
        <Link href={`/rooms/${created.roomId}`} className="btn-secondary">
          View room as a member
        </Link>
      </Page>
    );
  }

  return (
    <Page size="wide">
      <BackLink href="/rooms">Back</BackLink>
      <h1 className="a-h enter">
        Start a room for <em>your class</em>
      </h1>
      <p className="a-sub enter-2">You&apos;ll be the moderator. It takes a minute.</p>
      <form onSubmit={submit} className="grid gap-3.5 lg:grid-cols-2 lg:items-start lg:gap-x-10 lg:gap-y-5" noValidate>
        <section aria-label="Room settings" className="flex flex-col gap-3.5">
          <RoomSettingsFields value={settings} onChange={setSettings} />
        </section>

        <section aria-labelledby="upi-heading" className="flex flex-col gap-2.5">
          <h2 id="upi-heading" className="label">
            Where the money goes
          </h2>
          <p className="hint -mt-1.5">Add 2–3 UPI IDs so no single account gets swamped, and so there&apos;s a backup on the owner&apos;s own birthday.</p>
          {upis.map((u, i) => (
            <UpiFields
              key={u.key}
              index={i}
              draft={u}
              roomId="new"
              owners={owners}
              onChange={(d) => setUpis((list) => list.map((x) => (x.key === u.key ? d : x)))}
              onRemove={upis.length > 1 ? () => setUpis((list) => list.filter((x) => x.key !== u.key)) : undefined}
            />
          ))}
          {upis.length < 5 && (
            <button type="button" className="btn-secondary" onClick={() => setUpis((l) => [...l, blankUpi(null)])}>
              + Add another UPI ID
            </button>
          )}
        </section>

        <div className="flex flex-col gap-2 lg:col-span-2 lg:mx-auto lg:w-full lg:max-w-md">
          <ErrorNote>{error}</ErrorNote>
          <button type="submit" className="btn" disabled={!canSubmit}>
            {saving ? "Creating…" : "Create room"}
          </button>
          {!canSubmit && !saving && <p className="hint text-center">Add a room name, an amount and at least one valid UPI ID.</p>}
        </div>
      </form>
    </Page>
  );
}
