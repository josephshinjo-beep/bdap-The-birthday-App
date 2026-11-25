"use client";
import { useRef } from "react";

const ALLOWED = /[A-Z0-9]/;

/** Six boxes for a room code: auto-advance, uppercase, paste-friendly. */
export function CodeInput({ value, onChange, invalid = false, autoFocus = false }: { value: string; onChange: (v: string) => void; invalid?: boolean; autoFocus?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  function setFrom(index: number, raw: string) {
    const clean = raw.toUpperCase().split("").filter((c) => ALLOWED.test(c)).join("");
    if (!clean) return;
    const next = (value.slice(0, index) + clean).slice(0, 6);
    onChange(next);
    refs.current[Math.min(next.length, 5)]?.focus();
  }

  return (
    <div role="group" aria-label="Room code, 6 characters" className="flex justify-center gap-2">
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={c}
          autoFocus={autoFocus && i === 0}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          spellCheck={false}
          maxLength={6}
          aria-label={`Character ${i + 1}`}
          aria-invalid={invalid || undefined}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) {
              onChange(value.slice(0, i));
              return;
            }
            setFrom(i, v.length > 1 ? v.replace(c, "") || v : v);
          }}
          onPaste={(e) => {
            e.preventDefault();
            setFrom(0, e.clipboardData.getData("text"));
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !c && i > 0) {
              e.preventDefault();
              onChange(value.slice(0, i - 1));
              refs.current[i - 1]?.focus();
            } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          className={`h-14 w-11 rounded-2xl border-2 bg-surface text-center font-mono text-2xl uppercase text-ink transition-transform focus:-translate-y-0.5 focus:border-ink focus:outline-none sm:h-16 sm:w-13 ${
            invalid ? "border-danger" : c ? "border-ink" : "border-line"
          }`}
        />
      ))}
    </div>
  );
}
