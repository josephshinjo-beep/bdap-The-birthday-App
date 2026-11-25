"use client";
import { useState } from "react";

/** The room code as a plum ticket with Copy (and Share). */
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
    <div className="flex overflow-hidden rounded-[16px] bg-plum text-on-plum">
      <div className="flex-1 border-r-2 border-dashed border-white/30 p-3.5">
        <span className="label !text-plum-soft">Room code</span>
        <p className="font-mono text-[26px] tracking-[0.12em] text-sun" aria-label={`Room code ${code.split("").join(" ")}`}>
          {code}
        </p>
        <span className="hint !text-plum-soft">Share in your class group</span>
      </div>
      <div className="flex flex-col items-stretch justify-center gap-1.5 px-3.5">
        <button type="button" onClick={copy} className="min-h-10 rounded-sm bg-sun px-3 text-[13px] font-bold text-plum">
          {copied ? "Copied ✓" : "Copy"}
        </button>
        <button type="button" onClick={share} className="min-h-10 rounded-sm border-2 border-white/40 px-3 text-[13px] font-bold text-on-plum">
          Share
        </button>
      </div>
      <p className="sr-only" aria-live="polite">{copied ? "Code copied" : ""}</p>
    </div>
  );
}
