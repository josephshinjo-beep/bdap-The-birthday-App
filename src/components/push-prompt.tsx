"use client";
import { useEffect, useState } from "react";
import { data } from "@/lib/data";
import { isIOS, isStandalone, iosSupportsPush } from "@/components/install-prompt";

type PushState = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

// Trim stray spaces or quotes pasted into the dashboard (the server does the same).
const VAPID = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
const DISMISS_KEY = "bdap-push-dismissed";

function base64ToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function detect(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** Asks for push permission at a sensible moment. `variant="settings"` always shows. */
export function PushPrompt({ variant = "banner" }: { variant?: "banner" | "settings" }) {
  const [state, setState] = useState<PushState>("loading");
  const [dismissed, setDismissed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(variant === "banner" && localStorage.getItem(DISMISS_KEY) === "1");
    detect().then(setState).catch(() => setState("unsupported"));
  }, [variant]);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      if (VAPID) {
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(VAPID) }));
        const json = sub.toJSON();
        await data.savePushSubscription({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "", userAgent: navigator.userAgent.slice(0, 200) });
        setState("on");
      } else {
        setMsg("Notifications allowed. Push delivery starts once the server's VAPID keys are set.");
        setState("off");
      }
      await reg.showNotification("You're all set 🎉", { body: "Birthday heads-ups will show up here.", icon: "/icons/192" });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't turn on notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await data.deletePushSubscription(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;
  // On iPhone the app-wide install banner already asks people to install first, so don't add a second prompt.
  if (variant === "banner" && (dismissed || state === "on" || state === "unsupported" || state === "denied" || state === "ios-install")) return null;

  const body =
    state === "ios-install" ? (
      <>
        <p className="font-bold text-plum">Install bdap to get notifications on this iPhone</p>
        <p className="text-sm text-muted">
          {iosSupportsPush()
            ? "iPhone only allows notifications from apps on the home screen. Follow the steps under “App” above, open bdap from your home screen, then turn notifications on here."
            : "Notifications need iOS 16.4 or newer. Update in Settings → General → Software Update, then install bdap using the steps under “App” above."}
        </p>
      </>
    ) : state === "unsupported" ? (
      <p>This browser can&apos;t show push notifications. You&apos;ll still see everything in the bell.</p>
    ) : state === "denied" ? (
      <p>Notifications are blocked for bdap. Turn them on in your browser&apos;s site settings, then come back.</p>
    ) : state === "on" ? (
      <p className="font-bold text-ok">✓ Push notifications are on for this device.</p>
    ) : (
      <>
        <p className="font-bold text-plum">Want a nudge the evening before a birthday?</p>
        <p className="text-sm text-muted">We only send secret birthday heads-ups and room updates.</p>
      </>
    );

  return (
    <div className={`card ${variant === "banner" ? "!border-sun !bg-[var(--pill-sun-bg)]" : ""}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-plum font-display text-[13px] font-extrabold text-white">bd</span>
        <div className="min-w-0 flex-1">{body}</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {state === "off" && <button type="button" className="btn btn-sm" disabled={busy} onClick={enable}>{busy ? "Turning on…" : "Turn on notifications"}</button>}
        {state === "on" && variant === "settings" && <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={disable}>Turn off on this device</button>}
        {variant === "banner" && (
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => {
              localStorage.setItem(DISMISS_KEY, "1");
              setDismissed(true);
            }}
          >
            Not now
          </button>
        )}
      </div>
      {msg && <p className="mt-2 text-sm" role="status">{msg}</p>}
    </div>
  );
}
