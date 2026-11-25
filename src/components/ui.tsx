"use client";
// Small shared building blocks. Styling comes from theme tokens only.
import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import { countdownTo, startOfDayIST } from "@/lib/dates";

export function Page({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <main id="main" className={`mx-auto w-full flex-1 px-4 pb-28 pt-4 sm:px-6 ${narrow ? "max-w-xl" : "max-w-3xl"}`}>
      {children}
    </main>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[40vh] items-center justify-center gap-2 text-muted">
      <span className="pulse-dot h-3 w-3 rounded-full bg-accent" />
      <span className="pulse-dot h-3 w-3 rounded-full bg-sun [animation-delay:150ms]" />
      <span className="pulse-dot h-3 w-3 rounded-full bg-mint [animation-delay:300ms]" />
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function PageLoading() {
  return (
    <Page>
      <Loading />
    </Page>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-medium text-danger">
      <span aria-hidden="true">⚠</span>
      <span>{children}</span>
    </p>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card p-6 text-center">
      <p className="font-display text-xl font-bold">{title}</p>
      {children && <div className="mt-1 text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mb-3 inline-flex min-h-11 items-center gap-1 font-bold text-muted hover:text-ink">
      <span aria-hidden="true">←</span> {children}
    </Link>
  );
}

const AVATAR_COLOURS = ["bg-accent", "bg-sun", "bg-mint", "bg-sky"];

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  const colour = AVATAR_COLOURS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLOURS.length];
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full border-2 border-ink object-cover" style={{ width: size, height: size }} referrerPolicy="no-referrer" />;
  }
  return (
    <span
      aria-hidden="true"
      className={`${colour} inline-flex shrink-0 items-center justify-center rounded-full border-2 border-ink font-bold text-[#221b3a]`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || "?"}
    </span>
  );
}

/** Accessible on/off switch built on a native checkbox. */
export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block font-bold">{label}</span>
        {hint && <span className="hint block">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-8 w-14 rounded-full border-2 border-ink bg-surface-2 transition-colors peer-checked:bg-mint peer-focus-visible:outline-3 peer-focus-visible:outline-sky" />
        <span className="absolute left-1 top-1 h-6 w-6 rounded-full border-2 border-ink bg-surface transition-transform duration-200 [transition-timing-function:var(--ease-pop)] peer-checked:translate-x-6" />
      </span>
    </label>
  );
}

/** Live countdown to midnight IST of a date. */
export function Countdown({ date }: { date: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <div className="h-16" />;
  const c = countdownTo(startOfDayIST(date), now);
  if (c.done) return <p className="font-display text-2xl font-extrabold">It&apos;s today! 🎉</p>;
  const cells: [number, string][] = [
    [c.days, "days"],
    [c.hours, "hrs"],
    [c.minutes, "min"],
    [c.seconds, "sec"],
  ];
  return (
    <div className="flex gap-2" role="timer" aria-label={`${c.days} days ${c.hours} hours ${c.minutes} minutes to go`}>
      {cells.map(([v, l]) => (
        <div key={l} className="min-w-15 rounded-2xl border-2 border-ink bg-surface px-2 py-1.5 text-center text-ink">
          <span className="block font-mono text-2xl tabular-nums" aria-hidden="true">{String(v).padStart(2, "0")}</span>
          <span className="block text-xs font-bold uppercase tracking-wide text-muted" aria-hidden="true">{l}</span>
        </div>
      ))}
    </div>
  );
}

/** ARIA tabs (roving focus with arrow keys). */
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-full border-2 border-ink bg-surface p-1">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          id={`tab-${t.id}`}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          aria-controls={`panel-${t.id}`}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]!;
            onChange(next.id);
            document.getElementById(`tab-${next.id}`)?.focus();
          }}
          className={`min-h-11 flex-1 rounded-full px-3 font-bold transition-colors ${value === t.id ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={0} className="mt-4 outline-none">
      {children}
    </div>
  );
}

export function roleLabel(role: string) {
  return role === "moderator" ? "Moderator" : role === "co_moderator" ? "Co-moderator" : "Member";
}
