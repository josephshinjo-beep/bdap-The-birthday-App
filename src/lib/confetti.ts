"use client";
import confetti from "canvas-confetti";

const COLOURS = ["#ff4f7b", "#ffd23f", "#2ec4a0", "#4d8bff", "#ffffff"];

function reduced() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A burst from a point on screen (0–1 coordinates). Skipped under reduced motion. */
export function burst(x = 0.5, y = 0.5, particleCount = 90) {
  if (reduced()) return;
  void confetti({ particleCount, spread: 75, startVelocity: 38, origin: { x, y }, colors: COLOURS, disableForReducedMotion: true, zIndex: 60 });
}

export function burstFrom(el: Element | null, particleCount?: number) {
  if (!el) return burst();
  const r = el.getBoundingClientRect();
  burst((r.left + r.width / 2) / window.innerWidth, (r.top + r.height / 2) / window.innerHeight, particleCount);
}

export function celebrate() {
  if (reduced()) return;
  burst(0.2, 0.6, 70);
  setTimeout(() => burst(0.8, 0.6, 70), 160);
  setTimeout(() => burst(0.5, 0.35, 110), 320);
}
