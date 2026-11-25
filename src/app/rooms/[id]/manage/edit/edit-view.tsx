"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { CodeTicket } from "@/components/code-ticket";
import { RoomSettingsFields, UpiFields, ownerOptions, settingsValid, upiDraftValid, type UpiDraft } from "@/components/room-settings";
import { BackLink, EmptyState, ErrorNote, Loading, Page, roleLabel } from "@/components/ui";
import { data } from "@/lib/data";
import { useAsync } from "@/lib/use-async";
import type { Member, Room, RoomSettingsInput, Session, UpiAccount } from "@/lib/types";

export function EditView() {
  return <AuthGate>{(s) => <EditLoader session={s} />}</AuthGate>;
}

function EditLoader({ session }: { session: Session }) {
  const { id } = useParams<{ id: string }>();
  const room = useAsync(() => data.getRoom(id), [id, session.userId]);
  const members = useAsync(() => data.listMembers(id), [id]);
  const upis = useAsync(() => data.listUpiAccounts(id).catch(() => [] as UpiAccount[]), [id]);

  if (room.loading || members.loading || upis.loading) return <Page><Loading /></Page>;
  if (!room.data || room.data.myRole === "member" || room.data.myStatus !== "approved") {
    return (
      <Page>
        <EmptyState title="Moderators only" action={<Link href={`/rooms/${id}`} className="btn">Back to the room</Link>} />
      </Page>
    );
  }
  return <Edit room={room.data} members={members.data ?? []} upis={upis.data ?? []} session={session} reloadUpis={upis.reload} reloadMembers={members.reload} />;
}

function Edit({ room, members, upis, session, reloadUpis, reloadMembers }: { room: Room; members: Member[]; upis: UpiAccount[]; session: Session; reloadUpis: () => void; reloadMembers: () => void }) {
  const [settings, setSettings] = useState<RoomSettingsInput>({
    name: room.name, amountMode: room.amountMode, amount: room.amount, payersPerUpi: room.payersPerUpi,
    remindWeekBefore: room.remindWeekBefore, remindDayBefore: room.remindDayBefore, remindOnDay: room.remindOnDay,
  });
  const [code, setCode] = useState(room.code ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmCode, setConfirmCode] = useState(false);
  const owners = ownerOptions(members, session.userId);
  const isModerator = room.myRole === "moderator";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settingsValid(settings)) return setError("Check the room name and amount.");
    setSaving(true);
    setError(null);
    try {
      await data.updateRoom(room.id, settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function newCode() {
    try {
      setCode(await data.regenerateCode(room.id));
      setConfirmCode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make a new code.");
    }
  }

  const coMods = members.filter((m) => m.status === "approved" && m.role !== "moderator");

  return (
    <Page narrow>
      <BackLink href={`/rooms/${room.id}/manage`}>Dashboard</BackLink>
      <h1 className="font-display text-3xl font-extrabold">Edit room</h1>

      <form onSubmit={save} className="mt-6 space-y-6" noValidate>
        <RoomSettingsFields value={settings} onChange={setSettings} />
        <ErrorNote>{error}</ErrorNote>
        <button type="submit" className="btn w-full" disabled={saving}>{saving ? "Saving…" : saved ? "Saved ✓" : "Save settings"}</button>
        <p className="sr-only" aria-live="polite">{saved ? "Settings saved" : ""}</p>
      </form>

      <section aria-labelledby="upis" className="mt-10 space-y-3">
        <h2 id="upis" className="font-display text-xl font-bold">UPI IDs</h2>
        <p className="hint">Payers fill these in order, {settings.payersPerUpi} per UPI ID. Paused IDs get no new payers.</p>
        {upis.map((u, i) => (
          <ExistingUpi key={u.id} roomId={room.id} account={u} index={i} owners={owners} onChanged={reloadUpis} />
        ))}
        <NewUpi roomId={room.id} owners={owners} index={upis.length} onAdded={reloadUpis} />
      </section>

      {isModerator && (
        <section aria-labelledby="comods" className="mt-10">
          <h2 id="comods" className="font-display text-xl font-bold">Co-moderators</h2>
          <p className="hint">Co-moderators can let people in, see who paid and edit the room.</p>
          <ul className="card mt-3 divide-y divide-line p-0">
            {coMods.length === 0 && <li className="px-4 py-3 text-muted">No other members yet.</li>}
            {coMods.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-2 px-4 py-2">
                <span className="font-bold">{m.fullName} <span className="font-normal text-muted">· {roleLabel(m.role)}</span></span>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={async () => {
                    await data.setMemberRole(room.id, m.userId, m.role === "co_moderator" ? "member" : "co_moderator").catch((e: Error) => setError(e.message));
                    reloadMembers();
                  }}
                >
                  {m.role === "co_moderator" ? "Remove co-mod" : "Make co-mod"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="code" className="mt-10 space-y-3">
        <h2 id="code" className="font-display text-xl font-bold">Room code</h2>
        {code && <CodeTicket code={code} roomName={room.name} />}
        {confirmCode ? (
          <div className="card p-4">
            <p className="font-bold">Make a new code?</p>
            <p className="hint">The old code stops working. Everyone already in the room stays in.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn btn-sm" onClick={newCode}>Make a new code</button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirmCode(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn-ghost w-full" onClick={() => setConfirmCode(true)}>Make a new code</button>
        )}
      </section>
    </Page>
  );
}

function ExistingUpi({ roomId, account, index, owners, onChanged }: { roomId: string; account: UpiAccount; index: number; owners: { id: string | null; label: string }[]; onChanged: () => void }) {
  const [draft, setDraft] = useState<UpiDraft>({ key: account.id, upiId: account.upiId, payeeName: account.payeeName, ownerUserId: account.ownerUserId, qrImageUrl: account.qrImageUrl });
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const dirty = draft.upiId !== account.upiId || draft.payeeName !== account.payeeName || draft.ownerUserId !== account.ownerUserId || draft.qrImageUrl !== account.qrImageUrl;

  async function run(patch: Parameters<typeof data.updateUpiAccount>[2]) {
    setState("saving");
    setError(null);
    try {
      await data.updateUpiAccount(roomId, account.id, patch);
      setState("saved");
      onChanged();
      setTimeout(() => setState("idle"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
      setState("idle");
    }
  }

  return (
    <div className={account.active ? "" : "opacity-70"}>
      <UpiFields draft={draft} onChange={setDraft} owners={owners} roomId={roomId} index={index} />
      <div className="mt-2 flex flex-wrap gap-2">
        {dirty && (
          <button type="button" className="btn btn-sm" disabled={!upiDraftValid(draft) || state === "saving"} onClick={() => run({ upiId: draft.upiId, payeeName: draft.payeeName, ownerUserId: draft.ownerUserId, qrImageUrl: draft.qrImageUrl })}>
            Save UPI ID
          </button>
        )}
        <button type="button" className="btn-ghost btn-sm" onClick={() => run({ active: !account.active })}>
          {account.active ? "Pause this UPI ID" : "Turn back on"}
        </button>
        {state === "saved" && <span className="self-center text-sm font-bold text-ok" role="status">Saved ✓</span>}
      </div>
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}

function NewUpi({ roomId, owners, index, onAdded }: { roomId: string; owners: { id: string | null; label: string }[]; index: number; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const blank: UpiDraft = { key: "new", upiId: "", payeeName: "", ownerUserId: owners[0]?.id ?? null, qrImageUrl: null };
  const [draft, setDraft] = useState<UpiDraft>(blank);
  const [error, setError] = useState<string | null>(null);

  if (!open) return <button type="button" className="btn-ghost w-full" onClick={() => setOpen(true)}>+ Add a UPI ID</button>;
  return (
    <div>
      <UpiFields draft={draft} onChange={setDraft} owners={owners} roomId={roomId} index={index} onRemove={() => setOpen(false)} />
      <button
        type="button"
        className="btn btn-sm mt-2"
        disabled={!upiDraftValid(draft)}
        onClick={async () => {
          try {
            await data.addUpiAccount(roomId, { upiId: draft.upiId, payeeName: draft.payeeName, ownerUserId: draft.ownerUserId, qrImageUrl: draft.qrImageUrl });
            setDraft(blank);
            setOpen(false);
            onAdded();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't add it.");
          }
        }}
      >
        Add UPI ID
      </button>
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}
