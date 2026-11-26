"use client";
// "Add bdap to your home screen" for everyone.
// - Android / Chrome / Edge (desktop too): one tap opens the browser's real install dialog.
// - iPhone / iPad: browsers can't install for you, so the same button shows the 2-step Share guide.
// Hidden once installed (or when opened from the home screen), and for a week after "Not now".

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { dataMode } from "@/lib/data";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "bdap-install-dismissed-at";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

// The browser fires `beforeinstallprompt` once, early; keep it in a tiny shared store
// so both the banner and the profile page can use it.
let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export type InstallMode = "prompt" | "ios" | "installed" | "unavailable";

/** How this device can install bdap, plus a function that does it. */
export function useInstall() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => (installed || isStandalone() ? "installed" : deferred ? "prompt" : isIOS() ? "ios" : "unavailable"),
    () => "unavailable" as const,
  ) as InstallMode;

  async function install(): Promise<"accepted" | "dismissed" | "ios" | "unavailable"> {
    if (deferred) {
      const ev = deferred;
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      deferred = null;
      if (outcome === "accepted") installed = true;
      emit();
      return outcome;
    }
    return isIOS() ? "ios" : "unavailable";
  }

  return { mode: snapshot, install };
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline -mt-1">
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

/** The step-by-step guide for iPhone and iPad. */
export function IOSInstallSteps() {
  return (
    <ol className="flex flex-col gap-1.5 text-sm">
      <li className="flex gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-plum text-xs font-bold text-white">1</span>
        <span>
          Tap the <b>Share</b> button <ShareIcon /> in Safari (bottom of the screen, or top right on iPad).
        </span>
      </li>
      <li className="flex gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-plum text-xs font-bold text-white">2</span>
        <span>
          Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.
        </span>
      </li>
      <li className="flex gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-plum text-xs font-bold text-white">3</span>
        <span>Open bdap from your home screen. That&apos;s also what turns on birthday notifications on iPhone.</span>
      </li>
    </ol>
  );
}

/** App-wide banner. Shown to everyone who hasn't installed bdap yet. */
export function InstallBanner() {
  const { mode, install } = useInstall();
  const path = usePathname();
  const [visible, setVisible] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    if (mode === "installed" || mode === "unavailable") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);
      return;
    }
    const last = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (Date.now() - last < SNOOZE_MS) return;
    // Give the page a moment before asking.
    const t = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(t);
  }, [mode]);

  // Never cover the moment someone is unwrapping a gift or reading their wall.
  if (!visible || /\/(surprise|wall)\//.test(path)) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  async function onInstall() {
    const result = await install();
    if (result === "ios") setShowSteps(true);
    else if (result === "accepted") setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-labelledby="install-title"
      className={`pop-in fixed inset-x-3 z-[45] md:inset-x-auto md:right-5 md:w-[380px] ${dataMode === "mock" ? "bottom-20 md:bottom-5" : "bottom-3 md:bottom-5"}`}
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="card flex flex-col gap-3 border-2 border-plum shadow-[0_18px_40px_-18px_rgba(42,31,79,0.55)]">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/192" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-[12px]" />
          <div className="min-w-0 flex-1">
            <p id="install-title" className="font-display text-lg font-extrabold leading-tight text-plum">
              Get bdap on your home screen
            </p>
            <p className="text-[13px] text-muted">Opens in one tap like a real app, and birthday reminders arrive on time. Free, no app store.</p>
          </div>
          <button type="button" onClick={dismiss} aria-label="Close" className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2">
            ✕
          </button>
        </div>
        {showSteps && <IOSInstallSteps />}
        <div className="flex gap-2">
          {!showSteps && (
            <button type="button" className="btn btn-sm flex-1" onClick={onInstall}>
              {mode === "ios" ? "Add to Home Screen" : "Install bdap"}
            </button>
          )}
          <button type="button" className="btn-secondary btn-sm flex-1" onClick={dismiss}>
            {showSteps ? "Got it" : "Not now"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A permanent "Install the app" card for the profile page. */
export function InstallCard() {
  const { mode, install } = useInstall();
  const [steps, setSteps] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (mode === "installed") {
    return <p className="card text-sm font-bold text-ok">✓ bdap is installed on this device.</p>;
  }
  return (
    <div className="card flex flex-col gap-3">
      <p className="text-sm">
        <b className="text-plum">Install bdap</b> to open it in one tap from your home screen and get reminders like a real app.
      </p>
      {mode === "ios" && <IOSInstallSteps />}
      {mode === "prompt" && (
        <button
          type="button"
          className="btn btn-sm self-start"
          onClick={async () => {
            const r = await install();
            setMsg(r === "accepted" ? "Installed! Look for bdap on your home screen." : null);
          }}
        >
          Install bdap
        </button>
      )}
      {mode === "unavailable" && (
        <>
          {!steps && (
            <button type="button" className="btn-secondary btn-sm self-start" onClick={() => setSteps(true)}>
              How do I install it?
            </button>
          )}
          {steps && (
            <p className="text-sm text-muted">
              Open bdap in <b>Chrome</b> or <b>Edge</b> and use the browser menu → <b>Install app</b> / <b>Add to Home screen</b>. On iPhone, use Safari&apos;s Share button → <b>Add to Home Screen</b>.
            </p>
          )}
        </>
      )}
      {msg && (
        <p className="text-sm font-bold text-ok" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
