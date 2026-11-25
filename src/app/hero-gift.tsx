"use client";
import { useRef, useState } from "react";
import { GiftArt } from "@/components/gift";
import { burstFrom } from "@/lib/confetti";

const LINES = ["Tap the gift", "Again!", "One more…", "Surprise! 🎉"];

/** The interactive hero: tap the gift a few times to pop it open. */
export function HeroGift() {
  const [taps, setTaps] = useState(0);
  const [shaking, setShaking] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const open = taps >= 3;

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div aria-hidden="true" className="absolute inset-6 -z-10 rounded-full bg-sun/40 blur-2xl" />
      <button
        ref={ref}
        type="button"
        onClick={() => {
          const next = taps >= 3 ? 0 : taps + 1;
          setTaps(next);
          setShaking(true);
          setTimeout(() => setShaking(false), 420);
          if (next === 3) burstFrom(ref.current, 140);
        }}
        aria-label={open ? "Close the gift" : "Tap the gift to open it"}
        className={`rounded-full p-4 ${open ? "" : "float"}`}
      >
        <span className={`block ${shaking ? "shake" : ""}`}>
          <GiftArt size={260} open={open} />
        </span>
      </button>
      <p className="mt-2 font-display text-xl font-bold" aria-live="polite">
        {LINES[taps]}
      </p>
      {open && (
        <p className="pop-in mt-1 max-w-xs text-center text-muted">That&apos;s what your classmates see on the surprise page. The birthday person sees nothing.</p>
      )}
    </div>
  );
}
