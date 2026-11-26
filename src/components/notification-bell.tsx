"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { data } from "@/lib/data";
import type { AppNotification } from "@/lib/types";

function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Bell with unread count and a live in-app feed. */
export function NotificationBell() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [wiggle, setWiggle] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    const load = () => data.listNotifications().then((n) => live && setItems(n)).catch(() => {});
    load();
    const off = data.onNotification(() => {
      load();
      setWiggle(true);
      setTimeout(() => setWiggle(false), 500);
    });
    return () => {
      live = false;
      off();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const unread = items.filter((n) => !n.readAt).length;
  // Unread priority notifications (birthday reminders) are pinned first.
  const sorted = [...items].sort((a, b) => Number(b.priority && !b.readAt) - Number(a.priority && !a.readAt));

  async function markAll() {
    await data.markNotificationsRead().catch(() => {});
    setItems((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  }

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => setOpen((o) => !o)}
        className={`relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-plum hover:bg-surface-2 ${wiggle ? "shake" : ""}`}
      >
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span aria-hidden="true" className="pop-in absolute right-0.5 top-0.5 min-w-5 rounded-full border-2 border-bg bg-accent px-1 text-center text-xs font-bold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          ref={panel}
          id="notification-panel"
          // Phones: full width under the header (the bell isn't at the screen edge, so
          // anchoring to it pushes the panel off the left side). Larger screens: drop down under the bell.
          className="card pop-in fixed inset-x-3 top-[calc(env(safe-area-inset-top)+60px)] z-40 overflow-hidden p-0 md:absolute md:inset-x-auto md:right-0 md:top-12 md:w-[360px]"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-display font-bold text-plum">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="min-h-11 text-sm font-bold text-muted hover:text-plum">
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-muted">Nothing yet. Birthday heads-ups land here.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {sorted.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.url}
                    onClick={() => {
                      setOpen(false);
                      if (!n.readAt) void data.markNotificationsRead([n.id]).then(() => setItems((l) => l.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))));
                    }}
                    className={`flex gap-3 border-b border-line px-4 py-3 hover:bg-surface-2 ${n.priority && !n.readAt ? "bg-[var(--pill-pink-bg)]" : ""}`}
                  >
                    <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-accent"}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-plum">
                        {n.priority && !n.readAt && <span className="mr-1.5 rounded-full bg-accent px-1.5 py-0.5 align-middle text-[10px] font-bold text-white">Priority</span>}
                        {n.title}
                      </span>
                      <span className="block text-sm text-muted">{n.body}</span>
                      <span className="block text-xs text-muted">{timeAgo(n.createdAt)}{!n.readAt && <span className="sr-only">, unread</span>}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
