"use client";
import { useState } from "react";

const STEPS = [
  { k: "01", title: "Join with a code", body: "Your class moderator shares a 6-letter room code." },
  { k: "02", title: "Moderator lets you in", body: "Only real classmates get approved." },
  { k: "03", title: "Get a secret heads-up", body: "A day before and on the day. The birthday person sees nothing." },
  { k: "04", title: "Chip in with UPI", body: "Unwrap the QR, pay with any UPI app, tick done." },
];

/** "How it works" cards: tap one to highlight it. */
export function HowItWorks() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ol className="grid grid-cols-2 gap-2">
      {STEPS.map((s) => {
        const on = open === s.k;
        return (
          <li key={s.k}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => setOpen(on ? null : s.k)}
              className={`flex h-full w-full flex-col gap-1 rounded-[16px] border p-3 text-left transition-transform duration-150 hover:-translate-y-0.5 hover:-rotate-1 ${on ? "border-sun bg-sun" : "border-line bg-surface"}`}
            >
              <span className={`font-mono text-[11px] ${on ? "text-plum" : "text-accent"}`}>{s.k}</span>
              <b className="text-sm text-plum">{s.title}</b>
              <span className={`text-xs ${on ? "text-plum" : "text-muted"}`}>{s.body}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
