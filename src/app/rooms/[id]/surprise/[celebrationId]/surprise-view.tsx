"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { GiftArt } from "@/components/gift";
import { ScratchCard } from "@/components/scratch-card";
import { BackLink, Countdown, EmptyState, ErrorNote, Loading, Page } from "@/components/ui";
import { data } from "@/lib/data";
import { burstFrom, celebrate } from "@/lib/confetti";
import { daysBetween, formatISODayMonth, relativeDays, todayIST } from "@/lib/dates";
import { buildUpiLink, formatRupees } from "@/lib/upi";
import { useAsync } from "@/lib/use-async";
import type { Celebration, Pool, Room, Session, Surprise } from "@/lib/types";

export function SurpriseView() {
  return <AuthGate>{(s) => <SurpriseLoader session={s} />}</AuthGate>;
}

function SurpriseLoader({ session }: { session: Session }) {
  const { id, celebrationId } = useParams<{ id: string; celebrationId: string }>();
  const room = useAsync(() => data.getRoom(id), [id, session.userId]);
  const cel = useAsync(() => data.getCelebration(celebrationId), [celebrationId, session.userId]);

  if (room.loading || cel.loading) return <Page narrow><Loading /></Page>;
  // The birthday person (and anyone outside the room) gets the same plain page: nothing to give it away.
  if (!room.data || room.data.myStatus !== "approved" || !cel.data || cel.data.roomId !== id) {
    return (
      <Page narrow>
        <EmptyState title="Nothing here" action={<Link href={room.data ? `/rooms/${id}` : "/rooms"} className="btn">Back to the room</Link>}>
          This page doesn&apos;t exist or has moved.
        </EmptyState>
      </Page>
    );
  }
  return <SurpriseFlow room={room.data} celebration={cel.data} />;
}

const UNWRAP_KEY = (id: string) => `bdap-unwrapped-${id}`;

function SurpriseFlow({ room, celebration }: { room: Room; celebration: Celebration }) {
  const first = celebration.birthdayName.split(" ")[0];
  const [taps, setTaps] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [surprise, setSurprise] = useState<Surprise | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyOpened, setAlreadyOpened] = useState(false);
  const giftRef = useRef<HTMLButtonElement>(null);
  const isAdmin = room.myRole !== "member";
  const days = daysBetween(todayIST(), celebration.date);

  useEffect(() => {
    if (localStorage.getItem(UNWRAP_KEY(celebration.id)) !== "1") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAlreadyOpened(true);
    data.openSurprise(celebration.id).then(setSurprise).catch((e: Error) => setError(e.message));
  }, [celebration.id]);

  async function tapGift() {
    if (opening || surprise) return;
    const next = taps + 1;
    setTaps(next);
    setShaking(true);
    setTimeout(() => setShaking(false), 420);
    if (next < 3) return;
    burstFrom(giftRef.current, 150);
    setOpening(true);
    try {
      const s = await data.openSurprise(celebration.id);
      localStorage.setItem(UNWRAP_KEY(celebration.id), "1");
      setTimeout(() => setSurprise(s), 450);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the surprise.");
      setTaps(0);
    } finally {
      setOpening(false);
    }
  }

  return (
    <Page narrow>
      <BackLink href={`/rooms/${room.id}`}>{room.name}</BackLink>
      <div className="text-center">
        <p className="chip bg-night text-white" style={{ background: "var(--night)" }}>🤫 Top secret · {first} can&apos;t see this</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">{celebration.birthdayName}&apos;s birthday</h1>
        <p className="text-muted">{formatISODayMonth(celebration.date)} · {relativeDays(days)}</p>
        {days > 0 && (
          <div className="mt-3 flex justify-center">
            <Countdown date={celebration.date} />
          </div>
        )}
      </div>

      {!surprise ? (
        alreadyOpened && !error ? (
          <Loading label="Opening your surprise" />
        ) : (
          <div className="mt-8 flex flex-col items-center">
            <button
              ref={giftRef}
              type="button"
              onClick={tapGift}
              disabled={opening}
              aria-label={`Tap the gift to open it, ${Math.max(0, 3 - taps)} taps left`}
              className={`rounded-full p-2 ${taps === 0 ? "float" : ""}`}
            >
              <span className={`block ${shaking ? "shake" : ""}`}>
                <GiftArt size={220} open={taps >= 3} />
              </span>
            </button>
            <p className="mt-2 font-display text-xl font-bold" aria-live="polite">
              {taps === 0 ? "Tap the gift 3 times" : taps === 1 ? "Keep going…" : taps === 2 ? "One more!" : "Unwrapping…"}
            </p>
            <div className="mt-2 flex gap-1.5" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`h-2.5 w-8 rounded-full border-2 border-ink transition-colors ${i < taps ? "bg-accent" : "bg-surface"}`} />
              ))}
            </div>
            <ErrorNote>{error}</ErrorNote>
          </div>
        )
      ) : (
        <Revealed surprise={surprise} firstName={first!} />
      )}

      <PoolSection celebrationId={celebration.id} isAdmin={isAdmin} />
    </Page>
  );
}

function Revealed({ surprise, firstName }: { surprise: Surprise; firstName: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [paidAt, setPaidAt] = useState(surprise.myPaidAt);
  const [amount, setAmount] = useState<number | null>(surprise.myAmount ?? (surprise.amountMode === "suggested" ? surprise.amount : null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scratched, setScratched] = useState(Boolean(surprise.myPaidAt));

  const payAmount = surprise.amountMode === "fixed" ? surprise.amount : surprise.amountMode === "suggested" ? amount : amount;
  const link = surprise.upi ? buildUpiLink({ upiId: surprise.upi.upiId, payeeName: surprise.upi.payeeName, amount: payAmount, note: `${firstName} birthday` }) : null;

  useEffect(() => {
    if (!link || surprise.upi?.qrImageUrl) return;
    let live = true;
    QRCode.toDataURL(link, { margin: 1, width: 560, errorCorrectionLevel: "M", color: { dark: "#221b3a", light: "#ffffff" } })
      .then((url) => live && setQr(url))
      .catch(() => live && setQr(null));
    return () => {
      live = false;
    };
  }, [link, surprise.upi?.qrImageUrl]);

  async function togglePaid(next: boolean) {
    setSaving(true);
    setError(null);
    try {
      await data.markPaid(surprise.celebrationId, next, surprise.amountMode === "fixed" ? null : amount);
      setPaidAt(next ? new Date().toISOString() : null);
      if (next) celebrate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  if (!surprise.upi) {
    return (
      <div className="card mt-8 p-5 text-center">
        <p className="font-display text-xl font-bold">No UPI ID to pay yet</p>
        <p className="text-muted">The moderators haven&apos;t added a UPI ID that can take money for {firstName}. Check back soon.</p>
      </div>
    );
  }

  const qrSrc = surprise.upi.qrImageUrl ?? qr;

  return (
    <div className="mt-8 space-y-5">
      <ScratchCard revealed={scratched} onReveal={() => setScratched(true)}>
        <div className="flex flex-col items-center p-5 text-center">
          <div className="rounded-2xl border-2 border-ink bg-white p-2">
            {qrSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrSrc} alt={`UPI QR code to pay ${surprise.upi.payeeName}`} width={220} height={220} className="h-[220px] w-[220px] object-contain" />
            ) : (
              <div className="h-[220px] w-[220px]" />
            )}
          </div>
          <p className="mt-3 font-mono text-lg">{surprise.upi.upiId}</p>
          <p className="text-muted">Pay to {surprise.upi.payeeName}</p>
          {surprise.amountMode !== "any" && surprise.amount != null && (
            <p className="mt-1 font-display text-2xl font-extrabold">
              {surprise.amountMode === "fixed" ? formatRupees(surprise.amount) : `${formatRupees(surprise.amount)} suggested`}
            </p>
          )}
        </div>
      </ScratchCard>

      {scratched && (
        <div className="space-y-4 pop-in">
          {surprise.amountMode !== "fixed" && (
            <div className="max-w-56">
              <label htmlFor="pay-amount" className="label">Your amount (₹)</label>
              <input
                id="pay-amount"
                className="field"
                type="number"
                inputMode="numeric"
                min={1}
                max={100000}
                value={amount ?? ""}
                placeholder={surprise.amountMode === "any" ? "Any amount" : undefined}
                onChange={(e) => setAmount(e.target.value === "" ? null : Math.max(1, Math.round(Number(e.target.value))))}
              />
            </div>
          )}
          <a href={link ?? "#"} className="btn w-full text-lg">
            Pay with a UPI app
          </a>
          <p className="hint text-center">Opens GPay, PhonePe, Paytm or your bank app on your phone. On a laptop, scan the QR instead.</p>

          <label className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-3xl border-2 border-ink p-4 transition-colors ${paidAt ? "bg-mint text-[#221b3a]" : "bg-surface"}`}>
            <input type="checkbox" className="h-6 w-6 accent-[var(--ink)]" checked={Boolean(paidAt)} disabled={saving} onChange={(e) => togglePaid(e.target.checked)} />
            <span>
              <span className="block font-bold">{paidAt ? "You've chipped in 🎉" : "I've chipped in"}</span>
              <span className="block text-sm opacity-80">Tick this after paying. UPI doesn&apos;t tell bdap, so it&apos;s on your word.</span>
            </span>
          </label>
          <ErrorNote>{error}</ErrorNote>
          {surprise.allUpiFull && <p className="hint">Every UPI ID has its share of payers, so you&apos;ve been added to the least busy one. The moderators know.</p>}
        </div>
      )}
    </div>
  );
}

function PoolSection({ celebrationId, isAdmin }: { celebrationId: string; isAdmin: boolean }) {
  const pool = useAsync(() => data.getPool(celebrationId), [celebrationId]);
  const payers = useAsync(() => (isAdmin ? data.getPayers(celebrationId) : Promise.resolve([])), [celebrationId, isAdmin]);
  const reloadPool = pool.reload;
  const reloadPayers = payers.reload;

  useEffect(
    () =>
      data.onPoolChange(celebrationId, () => {
        reloadPool();
        reloadPayers();
      }),
    [celebrationId, reloadPool, reloadPayers],
  );

  const p: Pool | undefined = pool.data;
  if (!p) return null;
  const pct = p.eligibleCount ? Math.round((p.paidCount / p.eligibleCount) * 100) : 0;

  return (
    <section aria-labelledby="pool" className="mt-10">
      <h2 id="pool" className="font-display text-xl font-bold">The pool</h2>
      <div className="card mt-2 p-5">
        <p className="font-display text-2xl font-extrabold">
          {p.paidCount} of {p.eligibleCount} chipped in · {formatRupees(p.totalAmount)}
        </p>
        <div className="mt-3 h-5 overflow-hidden rounded-full border-2 border-ink bg-surface-2" role="progressbar" aria-valuenow={p.paidCount} aria-valuemin={0} aria-valuemax={p.eligibleCount} aria-label="People who chipped in">
          <div className="h-full rounded-full bg-mint transition-[width] duration-700 [transition-timing-function:var(--ease-out)]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {isAdmin && payers.data && payers.data.length > 0 && (
        <div className="mt-4">
          <h3 className="font-display text-lg font-bold">Who paid <span className="hint font-normal">(moderators only)</span></h3>
          <ul className="card mt-2 divide-y divide-line p-0">
            {payers.data.map((x) => (
              <li key={x.userId} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate font-bold">{x.fullName}</span>
                  <span className="block truncate text-xs text-muted">{x.upiId ?? "Hasn't opened it yet"}</span>
                </span>
                <span className={`chip ${x.paidAt ? "bg-mint text-[#221b3a]" : ""}`}>{x.paidAt ? `✓ ${x.amount ? formatRupees(x.amount) : "Paid"}` : "Not yet"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
