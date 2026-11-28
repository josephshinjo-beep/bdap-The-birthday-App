"use client";
// "Add bdap to your home screen" for everyone.
// - Android / Chrome / Edge (desktop too): one tap opens the browser's real install dialog.
// - iPhone / iPad: browsers can't install for you, so the same button shows the 2-step Share guide.
// Hidden once installed (or when opened from the home screen), and for a week after "Not now".

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
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

/**
 * Where an iPhone user is viewing bdap. Only Safari, and Chrome/Edge/Firefox on iOS 16.4+, can
 * add to the Home Screen; in-app browsers (Instagram, Facebook, Google app…) can't at all.
 * WhatsApp and Messages open links in a Safari view that looks like Safari but can't either,
 * which the steps mention because it can't be detected.
 */
export type IOSBrowser = "safari" | "other" | "in-app";

export function iosBrowser(): IOSBrowser {
  if (typeof navigator === "undefined") return "safari";
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|Instagram|Line\/|Snapchat|LinkedInApp|Twitter|GSA\/|musical_ly|BytedanceWebview/i.test(ua)) return "in-app";
  if (/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua)) return "other";
  return "safari";
}

/** False on iOS older than 16.4, where web apps can't get notifications. Unknown counts as supported. */
export function iosSupportsPush(): boolean {
  if (typeof navigator === "undefined") return true;
  const m = navigator.userAgent.match(/OS (\d+)[_.](\d+)/);
  if (!m) return true; // iPad in desktop mode doesn't say; assume a current version
  const [major, minor] = [Number(m[1]), Number(m[2])];
  return major > 16 || (major === 16 && minor >= 4);
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

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-plum text-xs font-bold text-white">{n}</span>
      <span>{children}</span>
    </li>
  );
}

/** The step-by-step guide for iPhone and iPad, adapted to the browser it's open in. */
export function IOSInstallSteps() {
  const browser = iosBrowser();
  const steps: ReactNode[] = [];
  if (browser === "in-app") steps.push(<>Open in <b>Safari</b></>);
  steps.push(
    <>
      Tap <b>Share</b> <ShareIcon />
    </>,
    <>
      Tap <b>Add to Home Screen</b>
    </>,
    <>Open bdap from your home screen</>,
  );
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-1.5 text-sm">
        {steps.map((s, i) => (
          <Step key={i} n={i + 1}>
            {s}
          </Step>
        ))}
      </ol>
      {!iosSupportsPush() && (
        <p className="rounded-[10px] bg-[var(--pill-sun-bg)] px-3 py-2 text-sm">
          Notifications need <b>iOS 16.4+</b>
        </p>
      )}
    </div>
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
              Install bdap
            </p>
            <p className="text-[13px] text-muted">Get birthday notifications</p>
          </div>
          <button type="button" onClick={dismiss} aria-label="Close" className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2">
            ✕
          </button>
        </div>
        {showSteps && <IOSInstallSteps />}
        <div className="flex gap-2">
          {!showSteps && (
            <button type="button" className="btn btn-sm flex-1" onClick={onInstall}>
              Install app
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
      <p className="text-sm font-bold text-plum">Install bdap</p>
      {mode === "ios" && <IOSInstallSteps />}
      {mode === "prompt" && (
        <button
          type="button"
          className="btn btn-sm self-start"
          onClick={async () => {
            const r = await install();
            setMsg(r === "accepted" ? "Installed" : null);
          }}
        >
          Install app
        </button>
      )}
      {mode === "unavailable" && (
        <>
          {!steps && (
            <button type="button" className="btn-secondary btn-sm self-start" onClick={() => setSteps(true)}>
              How to install
            </button>
          )}
          {steps && (
            <p className="text-sm text-muted">
              Browser menu → <b>Install app</b>
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
