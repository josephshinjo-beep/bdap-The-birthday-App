"use client";
import { useEffect, useState } from "react";
import { DEMO_USERS, getDemoUser, onMockChange, resetDemo, setDemoUser, type DemoUserId } from "@/lib/data/mock";

/** Mock mode only: switch between sample users to see every side of a room. */
export function DemoSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrent(getDemoUser());
    return onMockChange(() => setCurrent(getDemoUser()));
  }, []);

  const label = DEMO_USERS.find((u) => u.id === current)?.label ?? "Signed out";

  return (
    <div className="fixed bottom-3 left-3 z-40 text-sm" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {open && (
        <div className="card mb-2 w-64 p-3 pop-in" role="dialog" aria-label="Demo user">
          <p className="mb-2 font-bold">Demo mode: view as</p>
          <ul className="space-y-1">
            {DEMO_USERS.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => {
                    setDemoUser(u.id as DemoUserId);
                    setOpen(false);
                  }}
                  className={`w-full rounded-xl px-3 py-2 text-left min-h-11 transition-colors ${current === u.id ? "bg-sun text-[#221b3a]" : "hover:bg-surface-2"}`}
                >
                  <span className="block font-bold">{u.label}</span>
                  <span className="block text-xs opacity-75">{u.hint}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-ghost btn-sm flex-1" onClick={() => { setDemoUser(null); setOpen(false); }}>
              Sign out
            </button>
            <button type="button" className="btn-ghost btn-sm flex-1" onClick={() => { resetDemo(); setOpen(false); }}>
              Reset data
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="rounded-full border-2 border-ink bg-night px-4 min-h-11 font-bold text-white shadow-pop"
      >
        Demo · {label}
      </button>
    </div>
  );
}
