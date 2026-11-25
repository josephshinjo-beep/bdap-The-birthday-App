"use client";
// Small shared building blocks. Styling comes from theme tokens only.
import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import { countdownTo, startOfDayIST } from "@/lib/dates";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Page column. Phones get the blueprint's single column.
 * `size="narrow"` (default) stays a centred column for forms and single tasks.
 * `size="wide"` opens up to two columns on laptops; lay out children with
 * <Columns> inside it.
 */
export function Page({ children, size = "narrow" }: { children: ReactNode; size?: "narrow" | "wide"; narrow?: boolean }) {
  const width = size === "wide" ? "max-w-md md:max-w-3xl lg:max-w-6xl" : "max-w-md md:max-w-lg";
  return (
    <main id="main" className={`mx-auto flex w-full flex-1 flex-col gap-3.5 px-[18px] pb-28 pt-3 md:px-8 md:pt-8 lg:gap-5 ${width}`}>
      {children}
    </main>
  );
}

/** Main column + sidebar on laptops (sidebar sticks while you scroll); stacked on phones. */
export function Columns({ main, side, sideFirstOnMobile = false, stickySide = true }: { main: ReactNode; side: ReactNode; sideFirstOnMobile?: boolean; stickySide?: boolean }) {
  return (
    <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
      <div className={`flex min-w-0 flex-col gap-3.5 lg:gap-5 ${sideFirstOnMobile ? "order-2 lg:order-1" : ""}`}>{main}</div>
      <aside className={`flex min-w-0 flex-col gap-3.5 lg:gap-5 ${stickySide ? "lg:sticky lg:top-24" : ""} ${sideFirstOnMobile ? "order-1 lg:order-2" : ""}`}>{side}</aside>
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[40vh] items-center justify-center gap-2">
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
    <p role="alert" className="flex items-start gap-1.5 text-sm font-bold text-danger">
      <span aria-hidden="true">!</span>
      <span>{children}</span>
    </p>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 p-6 text-center">
      <p className="font-display text-xl font-extrabold text-plum">{title}</p>
      {children && <div className="a-sub">{children}</div>}
      {action && <div className="mt-2 w-full">{action}</div>}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="back">
      <span aria-hidden="true">←</span> {children}
    </Link>
  );
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?"
  );
}

/** Round avatar with initials (or the Google photo). */
export function Avatar({ name, url, size = 36 }: { name: string; url?: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} referrerPolicy="no-referrer" />;
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-avatar font-extrabold text-plum"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

/** Square room badge with initials, on sun. */
export function RoomBadge({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-md bg-sun font-display font-extrabold text-plum">
      {initials(name.replace(/[^A-Za-z ]/g, " "))}
    </span>
  );
}

/** Calendar-style day + month block. */
export function DateBlock({ month, day }: { month: number; day: number }) {
  return (
    <span className="block w-11 rounded-sm border border-line bg-surface py-[3px] text-center leading-tight">
      <b className="block font-display text-[17px] text-plum">{String(day).padStart(2, "0")}</b>
      <span className="text-[10px] font-bold uppercase text-accent">{MONTHS[month - 1]}</span>
    </span>
  );
}

/** Accessible on/off switch built on a native checkbox. */
export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 py-1.5 text-sm">
      <span>
        <span className="block font-medium text-ink">{label}</span>
        {hint && <span className="hint block">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-[42px] rounded-full bg-[var(--switch-off)] transition-colors peer-checked:bg-mint peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky" />
        <span className="absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform duration-200 peer-checked:translate-x-[18px]" />
      </span>
    </label>
  );
}

/** Live countdown to midnight IST of a date. `tone="pink"` for the pink celebration card. */
export function Countdown({ date, tone = "light" }: { date: string; tone?: "light" | "pink" }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <div className="h-[52px]" />;
  const c = countdownTo(startOfDayIST(date), now);
  if (c.done) return <p className="font-display text-xl font-extrabold">It&apos;s today! 🎉</p>;
  const cells: [number, string][] = [
    [c.days, "days"],
    [c.hours, "hrs"],
    [c.minutes, "min"],
    [c.seconds, "sec"],
  ];
  const cell = tone === "pink" ? "bg-white/20 text-white" : "bg-surface border border-line text-plum";
  return (
    <div className="flex gap-1.5" role="timer" aria-label={`${c.days} days ${c.hours} hours ${c.minutes} minutes to go`}>
      {cells.map(([v, l]) => (
        <div key={l} className={`min-w-[52px] rounded-sm px-2 py-1.5 text-center ${cell}`} aria-hidden="true">
          <b className="block font-mono text-lg">{String(v).padStart(2, "0")}</b>
          <span className="text-[10px] uppercase tracking-wider">{l}</span>
        </div>
      ))}
    </div>
  );
}

/** ARIA tabs (arrow keys move between tabs). */
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-md bg-surface-2 p-1">
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
          className={`min-h-10 flex-1 rounded-[9px] px-1 text-[13px] font-bold transition-colors ${value === t.id ? "bg-surface text-plum" : "text-muted hover:text-plum"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={0} className="flex flex-col gap-3.5 outline-none">
      {children}
    </div>
  );
}

export function roleLabel(role: string) {
  return role === "moderator" ? "Moderator" : role === "co_moderator" ? "Co-moderator" : "Member";
}
