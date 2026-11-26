"use client";
import { useEffect, useId, useState } from "react";
import { data } from "@/lib/data";
import { todayIST } from "@/lib/dates";
import { DataError, type ProfileInput } from "@/lib/types";
import { ErrorNote } from "./ui";

const USERNAME = /^[a-z0-9._]{3,24}$/;

function suggestUsername(name: string) {
  return name.toLowerCase().trim().replace(/\s+/g, ".").replace(/[^a-z0-9._]/g, "").slice(0, 24);
}

type Availability = "idle" | "checking" | "free" | "taken" | "invalid";

/** Full name, username (live availability) and date of birth. */
export function ProfileForm({
  initial,
  submitLabel,
  lockDob = false,
  onSaved,
}: {
  initial?: Partial<ProfileInput>;
  submitLabel: string;
  /** Show the date of birth read-only (it can't change once saved). */
  lockDob?: boolean;
  onSaved: (input: ProfileInput) => void | Promise<void>;
}) {
  const ids = { name: useId(), user: useId(), userHint: useId(), dob: useId(), dobHint: useId() };
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [username, setUsername] = useState(initial?.username ?? (initial?.fullName ? suggestUsername(initial.fullName) : ""));
  const [dob, setDob] = useState(initial?.dob ?? "");
  const [checked, setChecked] = useState<{ name: string; ok: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const original = initial?.username;

  const name = username.trim().toLowerCase();
  const needsCheck = Boolean(name) && USERNAME.test(name) && name !== original;
  const availability: Availability = !name
    ? "idle"
    : !USERNAME.test(name)
      ? "invalid"
      : name === original
        ? "free"
        : checked?.name === name
          ? checked.ok
            ? "free"
            : "taken"
          : "checking";

  useEffect(() => {
    if (!needsCheck) return;
    let live = true;
    const t = setTimeout(() => {
      data.usernameAvailable(name).then((ok) => live && setChecked({ name, ok })).catch(() => {});
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [name, needsCheck]);

  const today = todayIST();
  const dobValid = Boolean(dob) && dob < today && dob > "1900-01-01";
  const canSubmit = fullName.trim().length > 0 && availability === "free" && dobValid && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const input = { fullName: fullName.trim(), username: username.trim().toLowerCase(), dob };
    try {
      await data.saveProfile(input);
      await onSaved(input);
    } catch (err) {
      if (err instanceof DataError && err.code === "username_taken") {
        setChecked({ name: input.username, ok: false });
        setError("That username was just taken. Try another.");
      } else setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const userMsg: Record<Availability, string> = {
    idle: "3–24 characters: a–z, 0–9, dot or underscore.",
    checking: "Checking…",
    free: "✓ Available",
    taken: "✗ Already taken",
    invalid: "Use 3–24 characters: a–z, 0–9, dot or underscore.",
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
      <div>
        <label htmlFor={ids.name} className="label">Full name</label>
        <input
          id={ids.name}
          className="field"
          autoComplete="name"
          value={fullName}
          maxLength={80}
          required
          onChange={(e) => {
            setFullName(e.target.value);
            if (!username || username === suggestUsername(fullName)) setUsername(suggestUsername(e.target.value));
          }}
        />
      </div>
      <div>
        <label htmlFor={ids.user} className="label">Username</label>
        <div className="relative">
          <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">@</span>
          <input
            id={ids.user}
            className="field pl-8"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            maxLength={24}
            aria-describedby={ids.userHint}
            aria-invalid={availability === "taken" || availability === "invalid" || undefined}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
          />
        </div>
        <p
          id={ids.userHint}
          aria-live="polite"
          className={`mt-1 text-xs ${availability === "free" ? "font-bold text-ok" : availability === "taken" || availability === "invalid" ? "font-bold text-danger" : "text-muted"}`}
        >
          {userMsg[availability]}
        </p>
      </div>
      <div>
        <label htmlFor={ids.dob} className="label">Date of birth</label>
        {lockDob ? (
          <>
            <input id={ids.dob} type="date" className="field cursor-not-allowed bg-surface-2 text-muted" value={dob} readOnly aria-readonly="true" aria-describedby={ids.dobHint} />
            <p id={ids.dobHint} className="hint mt-1">🔒 Your birthday is locked once saved, so it can&apos;t be changed here. Classmates only see the day and month.</p>
          </>
        ) : (
          <>
            <input id={ids.dob} type="date" className="field" value={dob} max={today} min="1900-01-02" aria-describedby={ids.dobHint} onChange={(e) => setDob(e.target.value)} />
            <p id={ids.dobHint} className="hint mt-1">Classmates only see the day and month, never the year. <b className="text-plum">Check it carefully: you can&apos;t change it later.</b></p>
          </>
        )}
      </div>
      <ErrorNote>{error}</ErrorNote>
      <button type="submit" className="btn w-full" disabled={!canSubmit}>
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
