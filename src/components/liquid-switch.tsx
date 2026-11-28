"use client";
// A draggable on/off switch with a liquid fill: the pink fill and a trailing droplet sit
// under an SVG "goo" filter, so they stretch and merge as the bd knob moves.
// Tap, drag, Space or Enter all toggle it. The change fires from the click event, so
// callers can ask for browser permissions (e.g. notifications) inside onChange.

import { useId, useRef, useState, type CSSProperties, type PointerEvent } from "react";

const TRAVEL = 32; // px the knob moves between off and on

export function LiquidSwitch({
  checked,
  onChange,
  busy = false,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  busy?: boolean;
  label: string;
}) {
  const gooId = `goo-${useId().replace(/:/g, "")}`;
  const [drag, setDrag] = useState<number | null>(null); // 0..1 while dragging
  const [wobble, setWobble] = useState<{ n: number; on: boolean } | null>(null);
  const start = useRef<{ x: number; p: number; moved: boolean } | null>(null);
  const dragged = useRef<number | null>(null);

  const p = drag ?? (checked ? 1 : 0);

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, p: checked ? 1 : 0, moved: false };
    dragged.current = null;
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (!s.moved && Math.abs(dx) < 4) return;
    s.moved = true;
    const next = Math.min(1, Math.max(0, s.p + dx / TRAVEL));
    setDrag(next);
    dragged.current = next;
  }

  function onPointerUp() {
    start.current = null;
    setDrag(null);
  }

  // Runs after pointerup (and for keyboard): decide from the drag, or toggle on a plain tap.
  function onClick() {
    if (busy) return;
    const d = dragged.current;
    dragged.current = null;
    const next = d === null ? !checked : d > 0.5;
    if (next !== checked) {
      setWobble((w) => ({ n: (w?.n ?? 0) + 1, on: next }));
      onChange(next);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={busy}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
      className={`liquid-switch ${drag !== null ? "is-dragging" : ""} ${busy ? "is-busy" : ""}`}
      style={{ "--p": p } as CSSProperties}
    >
      <svg aria-hidden="true" width="0" height="0" className="absolute">
        <filter id={gooId}>
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feColorMatrix in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </svg>
      <span aria-hidden="true" className="liquid-switch__liquid" style={{ filter: `url(#${gooId})` }}>
        <span className="liquid-switch__tail" />
        <span className="liquid-switch__head" />
        <span className="liquid-switch__drop" />
      </span>
      <span aria-hidden="true" className="liquid-switch__knob">
        <span key={wobble?.n ?? 0} className={`liquid-switch__face ${wobble ? (wobble.on ? "wobble-on" : "wobble-off") : ""}`}>
          bd
        </span>
      </span>
    </button>
  );
}
