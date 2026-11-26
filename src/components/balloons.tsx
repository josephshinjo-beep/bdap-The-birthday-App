"use client";
import { useEffect, useId, useRef, useState } from "react";
import { burstFrom } from "@/lib/confetti";

const PALETTE = [
  { base: "#ff4f7b", dark: "#c92a55" },
  { base: "#ffd23f", dark: "#d9a400" },
  { base: "#2ec4a0", dark: "#16896f" },
  { base: "#4d8bff", dark: "#2457c9" },
  { base: "#ff8a5c", dark: "#d9582a" },
  { base: "#b07cff", dark: "#7c49d6" },
];

/** A short "pop": a burst of filtered noise. Silent if audio isn't allowed. */
function playPop() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const len = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1400;
    const gain = ctx.createGain();
    gain.gain.value = 0.6;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
    src.onended = () => void ctx.close();
  } catch {
    // no sound, no problem
  }
}

/** A glossy balloon you can pop. */
function Balloon({ left, size, delay, colorIndex }: { left: string; size: number; delay: number; colorIndex: number }) {
  const gid = useId().replace(/:/g, "");
  const ref = useRef<HTMLButtonElement>(null);
  const [color, setColor] = useState(colorIndex % PALETTE.length);
  const [state, setState] = useState<"float" | "pop" | "gone">("float");
  const c = PALETTE[color]!;

  useEffect(() => {
    if (state === "pop") {
      const t = setTimeout(() => setState("gone"), 260);
      return () => clearTimeout(t);
    }
    if (state === "gone") {
      const t = setTimeout(() => {
        setColor((x) => (x + 2) % PALETTE.length);
        setState("float");
      }, 2200);
      return () => clearTimeout(t);
    }
  }, [state]);

  function pop() {
    if (state !== "float") return;
    playPop();
    burstFrom(ref.current, 45);
    setState("pop");
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={pop}
      aria-label="Pop the balloon"
      className={`balloon-btn absolute bottom-0 ${state === "gone" ? "pointer-events-none" : ""}`}
      style={{ left, width: size, height: size * 2, animationDelay: `${delay}s` }}
    >
      <svg
        viewBox="0 0 60 120"
        width={size}
        height={size * 2}
        aria-hidden="true"
        className={state === "pop" ? "balloon-pop" : state === "gone" ? "opacity-0" : "balloon-in"}
      >
        <defs>
          <radialGradient id={`g${gid}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="18%" stopColor={c.base} />
            <stop offset="100%" stopColor={c.dark} />
          </radialGradient>
        </defs>
        {/* curly string */}
        <path d="M30 66 C 22 76, 38 84, 30 94 S 24 110, 31 120" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.4" />
        {/* body */}
        <path d="M30 2 C 52 2, 58 22, 56 34 C 53 50, 40 60, 32 64 L 28 64 C 20 60, 7 50, 4 34 C 2 22, 8 2, 30 2 Z" fill={`url(#g${gid})`} />
        {/* knot */}
        <path d="M26 63 L 34 63 L 32 69 L 28 69 Z" fill={c.dark} />
        {/* shine */}
        <ellipse cx="20" cy="18" rx="5" ry="9" fill="#ffffff" opacity="0.55" transform="rotate(-25 20 18)" />
        <ellipse cx="24" cy="32" rx="1.6" ry="3" fill="#ffffff" opacity="0.4" />
      </svg>
    </button>
  );
}

/** A row of poppable balloons that sway and rise. Place inside a `relative overflow-hidden` box. */
export function BalloonField({ count = 3, sizes = [44, 52, 40, 48, 38], start = 0 }: { count?: number; sizes?: number[]; start?: number }) {
  const spots = Array.from({ length: count }, (_, i) => ({
    left: `calc(${100 - (i + 1) * (88 / (count + 0.5))}% )`,
    size: sizes[i % sizes.length]!,
    delay: -i * 1.7,
    colorIndex: start + i,
  }));
  return (
    <>
      {spots.map((s, i) => (
        <Balloon key={i} {...s} />
      ))}
    </>
  );
}
