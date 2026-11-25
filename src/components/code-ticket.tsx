"use client";
import { useState } from "react";

/** The room code as a ticket, with Copy and Share. */
export function CodeTicket({ code, roomName }: { code: string; roomName: string }) {
  const [copied, setCopied] = useState(false);
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/join?code=${code}` : `/join?code=${code}`;
  const shareText = `Join ${roomName} on bdap with code ${code}: ${joinUrl}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the code is still on screen to copy by hand.
    }
  }

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: `Join ${roomName}`, text: shareText }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener");
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-ink bg-sun p-5 text-[#221b3a] shadow-pop">
      <span aria-hidden="true" className="absolute -left-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full border-2 border-ink bg-bg" />
      <span aria-hidden="true" className="absolute -right-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full border-2 border-ink bg-bg" />
      <p className="text-center text-sm font-bold uppercase tracking-widest">Room code</p>
      <p className="my-2 text-center font-mono text-4xl tracking-[0.3em] sm:text-5xl" aria-label={`Room code ${code.split("").join(" ")}`}>
        {code}
      </p>
      <div className="mt-3 flex justify-center gap-2">
        <button type="button" onClick={copy} className="btn btn-sm btn-light">
          {copied ? "Copied ✓" : "Copy code"}
        </button>
        <button type="button" onClick={share} className="btn-ghost btn-sm">
          Share
        </button>
      </div>
      <p className="sr-only" aria-live="polite">{copied ? "Code copied" : ""}</p>
    </div>
  );
}
