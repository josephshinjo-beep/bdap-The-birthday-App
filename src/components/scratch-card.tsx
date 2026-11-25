"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A scratch-off layer over its children. Scratch with a finger or mouse; once
 * about 45% is cleared it reveals fully. A plain button reveals without
 * scratching (keyboard, screen readers, or anyone who doesn't want to drag).
 */
export function ScratchCard({ children, onReveal, revealed: initiallyRevealed = false }: { children: ReactNode; onReveal?: () => void; revealed?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(initiallyRevealed);
  const drawing = useRef(false);
  const moves = useRef(0);

  function reveal() {
    setRevealed(true);
    onReveal?.();
  }

  useEffect(() => {
    if (revealed) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = wrap.getBoundingClientRect();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, css.getPropertyValue("--sun").trim() || "#ffd23f");
    grad.addColorStop(1, css.getPropertyValue("--accent").trim() || "#ff4f7b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(34,27,58,0.12)";
    for (let i = 0; i < 70; i++) ctx.fillRect(Math.random() * width, Math.random() * height, 3, 3);
    ctx.fillStyle = "#221b3a";
    ctx.font = "800 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Scratch here ✨", width / 2, height / 2);
    ctx.font = "500 14px system-ui, sans-serif";
    ctx.fillText("your QR is underneath", width / 2, height / 2 + 24);
  }, [revealed]);

  function scratch(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(e.clientX - rect.left, e.clientY - rect.top, 24, 0, Math.PI * 2);
    ctx.fill();
    if (++moves.current % 12 === 0) checkCleared();
  }

  function checkCleared() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 64) {
      total++;
      if (data[i] === 0) clear++;
    }
    if (clear / total > 0.45) reveal();
  }

  return (
    <div>
      <div ref={wrapRef} className="relative overflow-hidden rounded-3xl border-2 border-ink bg-surface">
        <div aria-hidden={!revealed} className={revealed ? "pop-in" : ""}>
          {children}
        </div>
        {!revealed && (
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
            onPointerDown={(e) => {
              drawing.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              scratch(e);
            }}
            onPointerMove={scratch}
            onPointerUp={() => {
              drawing.current = false;
              checkCleared();
            }}
            onPointerCancel={() => (drawing.current = false)}
          />
        )}
      </div>
      {!revealed && (
        <button type="button" onClick={reveal} className="mt-3 min-h-11 w-full font-bold text-muted underline underline-offset-4 hover:text-ink">
          Reveal without scratching
        </button>
      )}
    </div>
  );
}
