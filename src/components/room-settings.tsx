"use client";
import { useId, useRef, useState } from "react";
import { data } from "@/lib/data";
import { isValidUpiId } from "@/lib/upi";
import type { AmountMode, Member, RoomSettingsInput } from "@/lib/types";
import { ErrorNote, Toggle } from "./ui";

export const DEFAULT_SETTINGS: RoomSettingsInput = {
  name: "",
  amountMode: "suggested",
  amount: 50,
  payersPerUpi: 20,
  remindWeekBefore: false,
  remindDayBefore: true,
  remindOnDay: true,
};

const MODES: { id: AmountMode; label: string; hint: string }[] = [
  { id: "fixed", label: "Fixed", hint: "Everyone pays the same amount." },
  { id: "suggested", label: "Suggested", hint: "A nudge. People can pay what they like." },
  { id: "any", label: "Any", hint: "No amount shown. People pay what they like." },
];

const AMOUNTS = [20, 50, 100];

export function settingsValid(s: RoomSettingsInput) {
  return s.name.trim().length > 0 && s.payersPerUpi >= 1 && s.payersPerUpi <= 1000 && (s.amountMode === "any" || (s.amount != null && s.amount >= 1 && s.amount <= 100000));
}

/** Room name, amount mode, payers per UPI ID and reminder switches. */
export function RoomSettingsFields({ value, onChange }: { value: RoomSettingsInput; onChange: (v: RoomSettingsInput) => void }) {
  const ids = { name: useId(), amount: useId(), payers: useId(), payersHint: useId() };
  const set = <K extends keyof RoomSettingsInput>(k: K, v: RoomSettingsInput[K]) => onChange({ ...value, [k]: v });

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <label htmlFor={ids.name} className="label">Room name</label>
        <input id={ids.name} className="field" placeholder="CSE-B · 2nd Year" maxLength={80} value={value.name} onChange={(e) => set("name", e.target.value)} />
      </div>

      <fieldset>
        <legend className="label mb-[5px]">How people chip in</legend>
        <div className="seg">
          {MODES.map((m) => (
            <label key={m.id}>
              <input type="radio" name="amount-mode" className="sr-only" checked={value.amountMode === m.id} onChange={() => set("amountMode", m.id)} />
              {m.label}
            </label>
          ))}
        </div>
        <p className="hint mt-1">{MODES.find((m) => m.id === value.amountMode)?.hint}</p>
      </fieldset>

      {value.amountMode !== "any" && (
        <fieldset>
          <legend className="label mb-[5px]">{value.amountMode === "fixed" ? "Amount per person" : "Suggested amount"}</legend>
          <div className="seg">
            {AMOUNTS.map((a) => (
              <button key={a} type="button" aria-pressed={value.amount === a} onClick={() => set("amount", a)}>
                ₹{a}
              </button>
            ))}
          </div>
          <label htmlFor={ids.amount} className="sr-only">Other amount in rupees</label>
          <input
            id={ids.amount}
            className="field mt-1.5"
            type="number"
            inputMode="numeric"
            placeholder="Other amount (₹)"
            min={1}
            max={100000}
            value={value.amount != null && !AMOUNTS.includes(value.amount) ? value.amount : ""}
            onChange={(e) => set("amount", e.target.value === "" ? null : Math.round(Number(e.target.value)))}
          />
        </fieldset>
      )}

      <div>
        <label htmlFor={ids.payers} className="label">Payers per UPI ID</label>
        <input
          id={ids.payers}
          className="field"
          type="number"
          inputMode="numeric"
          min={1}
          max={1000}
          aria-describedby={ids.payersHint}
          value={value.payersPerUpi}
          onChange={(e) => set("payersPerUpi", Math.max(1, Math.round(Number(e.target.value) || 1)))}
        />
      </div>
      <p id={ids.payersHint} className="hint -mt-2.5">Once a UPI ID has this many people, the next payer gets the next UPI ID.</p>

      <fieldset className="card">
        <legend className="sr-only">Secret reminders</legend>
        <span className="label" aria-hidden="true">Secret reminders</span>
        <Toggle label="Day before, 6:00 PM" checked={value.remindDayBefore} onChange={(v) => set("remindDayBefore", v)} />
        <Toggle label="On the day, 7:30 AM" checked={value.remindOnDay} onChange={(v) => set("remindOnDay", v)} />
        <Toggle label="A week before (to plan)" checked={value.remindWeekBefore} onChange={(v) => set("remindWeekBefore", v)} />
      </fieldset>
    </div>
  );
}

export interface UpiDraft {
  key: string;
  upiId: string;
  payeeName: string;
  ownerUserId: string | null;
  qrImageUrl: string | null;
}

export function upiDraftValid(d: UpiDraft) {
  return isValidUpiId(d.upiId) && d.payeeName.trim().length > 0;
}

/** One UPI ID row: handle, payee, owner and an optional QR image. */
export function UpiFields({
  draft,
  onChange,
  onRemove,
  owners,
  roomId,
  index,
}: {
  draft: UpiDraft;
  onChange: (d: UpiDraft) => void;
  onRemove?: () => void;
  owners: { id: string | null; label: string }[];
  roomId: string;
  index: number;
}) {
  const ids = { upi: useId(), payee: useId(), owner: useId(), qr: useId() };
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const badUpi = draft.upiId.length > 3 && !isValidUpiId(draft.upiId);

  async function upload(file: File) {
    if (file.size > 2 * 1024 * 1024) return setError("Keep the image under 2 MB.");
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError("Use a PNG, JPG or WebP image.");
    setUploading(true);
    setError(null);
    try {
      onChange({ ...draft, qrImageUrl: await data.uploadQrImage(roomId, file) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <fieldset className="card">
      <legend className="sr-only">UPI ID {index + 1}</legend>
      <div className="mb-2 flex items-center justify-between">
        <span className="pill" aria-hidden="true">UPI ID {index + 1}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} className="min-h-10 px-1 text-[13px] font-bold text-danger">Remove</button>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor={ids.upi} className="label">UPI ID that collects money</label>
          <input id={ids.upi} className="field" placeholder="name@okaxis" autoCapitalize="none" spellCheck={false} value={draft.upiId} aria-invalid={badUpi || undefined} onChange={(e) => onChange({ ...draft, upiId: e.target.value.trim() })} />
          {badUpi && <ErrorNote>That doesn&apos;t look like a UPI ID (name@bank).</ErrorNote>}
        </div>
        <div>
          <label htmlFor={ids.payee} className="label">Payee name</label>
          <input id={ids.payee} className="field" placeholder="As shown in UPI apps" maxLength={80} value={draft.payeeName} onChange={(e) => onChange({ ...draft, payeeName: e.target.value })} />
        </div>
        <div>
          <label htmlFor={ids.owner} className="label">Whose account is this?</label>
          <select id={ids.owner} className="field" value={draft.ownerUserId ?? ""} onChange={(e) => onChange({ ...draft, ownerUserId: e.target.value || null })}>
            {owners.map((o) => (
              <option key={o.id ?? "none"} value={o.id ?? ""}>{o.label}</option>
            ))}
          </select>
          <p className="hint mt-1">On the owner&apos;s own birthday, payers get a different UPI ID.</p>
        </div>
        <div>
          <span className="label" id={ids.qr}>QR image (optional)</span>
          <div className="flex items-center gap-2">
            {draft.qrImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.qrImageUrl} alt={`Uploaded QR for ${draft.upiId || "this UPI ID"}`} className="h-12 w-12 rounded-sm border border-line object-cover" />
            )}
            <button type="button" className="btn-secondary btn-sm" aria-describedby={ids.qr} onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? "Uploading…" : draft.qrImageUrl ? "Replace" : "Upload QR"}
            </button>
            {draft.qrImageUrl && (
              <button type="button" className="min-h-11 px-2 text-sm font-bold text-muted" onClick={() => onChange({ ...draft, qrImageUrl: null })}>Remove</button>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </div>
          <p className="hint mt-1">We make the QR from the UPI ID. Or upload your QR image instead.</p>
          <ErrorNote>{error}</ErrorNote>
        </div>
      </div>
    </fieldset>
  );
}

export function ownerOptions(members: Member[], meId: string) {
  return [
    ...members.filter((m) => m.status === "approved").map((m) => ({ id: m.userId as string | null, label: m.userId === meId ? `Me (${m.fullName})` : m.fullName })),
    { id: null, label: "Not a member of this room" },
  ];
}
