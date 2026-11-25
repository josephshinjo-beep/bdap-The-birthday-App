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

  // At creation the only member is you; add classmates' UPI IDs from Edit room later.
  const owners = [
    { id: me.id as string | null, label: `Me (${me.fullName})` },
    { id: null, label: "Someone else (link them later)" },
  ];
  const filled = upis.filter((u) => u.upiId || u.payeeName.trim() !== me.fullName);
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
      <Page narrow>
        <div className="pop-in mt-6 text-center">
          <h1 className="font-display text-3xl font-extrabold">{settings.name} is ready 🎉</h1>
          <p className="mt-1 text-muted">Share this code in your class group. You&apos;ll let people in from the dashboard.</p>
        </div>
        <div className="mt-6">
          <CodeTicket code={created.code} roomName={settings.name} />
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <Link href={`/rooms/${created.roomId}/manage`} className="btn">Open the dashboard</Link>
          <Link href={`/rooms/${created.roomId}`} className="btn-ghost">See the room</Link>
        </div>
      </Page>
    );
  }

  return (
    <Page narrow>
      <BackLink href="/rooms">My rooms</BackLink>
      <h1 className="enter font-display text-3xl font-extrabold">Create a room for your class</h1>
      <p className="enter-2 text-muted">You&apos;ll be the moderator. It takes a minute.</p>
      <form onSubmit={submit} className="mt-6 space-y-8" noValidate>
        <RoomSettingsFields value={settings} onChange={setSettings} />

        <section aria-labelledby="upi-heading" className="space-y-3">
          <div>
            <h2 id="upi-heading" className="font-display text-xl font-bold">Where the money goes</h2>
            <p className="hint">Add 2–3 UPI IDs so no single account gets swamped, and so there&apos;s a backup on the owner&apos;s own birthday.</p>
          </div>
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
            <button type="button" className="btn-ghost w-full" onClick={() => setUpis((l) => [...l, blankUpi(null)])}>
              + Add another UPI ID
            </button>
          )}
          {upis.length < 2 && filled.length > 0 && <p className="hint">Tip: add a second UPI ID that belongs to someone else.</p>}
        </section>

        <ErrorNote>{error}</ErrorNote>
        <button type="submit" className="btn w-full" disabled={!canSubmit}>
          {saving ? "Creating…" : "Create room"}
        </button>
        {!canSubmit && !saving && <p className="hint -mt-6 text-center">Add a room name, an amount and at least one valid UPI ID.</p>}
      </form>
    </Page>
  );
}
