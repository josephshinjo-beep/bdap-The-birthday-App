"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { GiftArt } from "@/components/gift";
import { ScratchCard } from "@/components/scratch-card";
import { Avatar, BackLink, Columns, Countdown, EmptyState, ErrorNote, Loading, Page } from "@/components/ui";
import { data } from "@/lib/data";
import { burstFrom, celebrate } from "@/lib/confetti";
import { daysBetween, formatISODayMonth, relativeDays, todayIST } from "@/lib/dates";
import { buildUpiLink, formatRupees } from "@/lib/upi";
import { useAsync } from "@/lib/use-async";
import type { Celebration, Room, Session, Surprise } from "@/lib/types";

export function SurpriseView() {
  return <AuthGate>{(s) => <SurpriseLoader session={s} />}</AuthGate>;
}

function SurpriseLoader({ session }: { session: Session }) {
  const { id, celebrationId } = useParams<{ id: string; celebrationId: string }>();
  const room = useAsync(() => data.getRoom(id), [id, session.userId]);
  const cel = useAsync(() => data.getCelebration(celebrationId), [celebrationId, session.userId]);

  if (room.loading || cel.loading)
    return (
      <Page>
        <Loading />
      </Page>
    );
  // The birthday person (and anyone outside the room) gets the same plain page: nothing to give it away.
  if (!room.data || room.data.myStatus !== "approved" || !cel.data || cel.data.roomId !== id) {
    return (
      <Page>
        <EmptyState
          title="Nothing here"
          action={
            <Link href={room.data ? `/rooms/${id}` : "/rooms"} className="btn w-full">
              Back to the room
            </Link>
          }
        >
          This page doesn&apos;t exist or has moved.
        </EmptyState>
      </Page>
    );
  }
  if (cel.data.decision !== "celebrate") {
    // Only admins can reach this (members never see unapproved celebrations).
    const first = cel.data.birthdayName.split(" ")[0];
    return (
      <Page>
        <EmptyState
          title={cel.data.decision === "wish_only" ? `${first}'s birthday is wish only` : `${first}'s birthday isn't approved yet`}
          action={
            <Link href={`/rooms/${id}/manage?tab=birthdays`} className="btn w-full">
              Decide in the dashboard
            </Link>
          }
        >
          The surprise page and UPI collection open once an admin chooses Celebrate.
        </EmptyState>
      </Page>
    );
  }
  return <SurpriseFlow room={room.data} celebration={cel.data} />;
}

const UNWRAP_KEY = (id: string) => `bdap-unwrapped-${id}`;

function SurpriseFlow({ room, celebration }: { room: Room; celebration: Celebration }) {
  const first = celebration.birthdayName.split(" ")[0]!;
  const [taps, setTaps] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [surprise, setSurprise] = useState<Surprise | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyOpened, setAlreadyOpened] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);

  function receive(s: Surprise) {
    setAmount(s.myAmount ?? (s.amountMode === "suggested" ? s.amount : null));
    setSurprise(s);
  }
  const giftRef = useRef<HTMLButtonElement>(null);
  const isAdmin = room.myRole !== "member";
  const days = daysBetween(todayIST(), celebration.date);

  useEffect(() => {
    if (localStorage.getItem(UNWRAP_KEY(celebration.id)) !== "1") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAlreadyOpened(true);
    data
      .openSurprise(celebration.id)
      .then(receive)
      .catch((e: Error) => setError(e.message));
  }, [celebration.id]);

  async function tapGift() {
    if (opening || surprise) return;
    const next = taps + 1;
    setTaps(next);
    setShaking(true);
    setTimeout(() => setShaking(false), 400);
    if (next < 3) return;
    burstFrom(giftRef.current, 150);
    setOpening(true);
    try {
      const s = await data.openSurprise(celebration.id);
      localStorage.setItem(UNWRAP_KEY(celebration.id), "1");
      setTimeout(() => receive(s), 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the surprise.");
      setTaps(0);
    } finally {
      setOpening(false);
    }
  }

  return (
    <Page size="wide">
      <BackLink href={`/rooms/${room.id}`}>Room</BackLink>
      <Columns
        stickySide={!isAdmin}
        main={
          <>
            <span className="pill pill-pink self-start">Top secret · {first} can&apos;t see this</span>
            <h1 className="a-h">
              A gift for <em>{first}</em>
            </h1>
            <p className="a-sub -mt-2">
              {formatISODayMonth(celebration.date)} · {relativeDays(days)}
            </p>
            {days > 0 && <Countdown date={celebration.date} />}
            <div className="flex flex-col gap-3 md:mx-auto md:w-full md:max-w-md lg:mx-0">
              {!surprise ? (
                alreadyOpened && !error ? (
                  <Loading label="Opening your surprise" />
                ) : (
                  <div className="flex flex-col items-center gap-2.5">
                    <button
                      ref={giftRef}
                      type="button"
                      onClick={tapGift}
                      disabled={opening}
                      aria-label={`Tap the gift to unwrap it, ${Math.max(0, 3 - taps)} taps left`}
                      className={`rounded-lg ${taps === 0 ? "float" : ""} ${shaking ? "shake" : ""}`}
                    >
                      <GiftArt size={170} open={taps >= 3} />
                    </button>
                    <p className="text-center text-[13px] text-muted" aria-live="polite">
                      {taps === 0 ? "Tap the gift 3 times to unwrap" : taps === 1 ? "Keep going…" : taps === 2 ? "One more!" : "Unwrapping…"}
                    </p>
                    <ErrorNote>{error}</ErrorNote>
                  </div>
                )
              ) : (
                <Revealed surprise={surprise} firstName={first} amount={amount} onAmount={setAmount} />
              )}
            </div>
          </>
        }
        side={<PoolCard celebrationId={celebration.id} isAdmin={isAdmin} surprise={surprise} amount={amount} />}
      />
    </Page>
  );
}

function Revealed({ surprise, firstName, amount, onAmount }: { surprise: Surprise; firstName: string; amount: number | null; onAmount: (v: number | null) => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [scratched, setScratched] = useState(Boolean(surprise.myPaidAt));

  const payAmount = surprise.amountMode === "fixed" ? surprise.amount : amount;
  const link = surprise.upi ? buildUpiLink({ upiId: surprise.upi.upiId, payeeName: surprise.upi.payeeName, amount: payAmount, note: `${firstName} birthday` }) : null;

  useEffect(() => {
    if (!link || surprise.upi?.qrImageUrl) return;
    let live = true;
    QRCode.toDataURL(link, { margin: 1, width: 480, errorCorrectionLevel: "M", color: { dark: "#2a1f4f", light: "#ffffff" } })
      .then((url) => live && setQr(url))
      .catch(() => live && setQr(null));
    return () => {
      live = false;
    };
  }, [link, surprise.upi?.qrImageUrl]);

  if (!surprise.upi) {
    return (
      <div className="card text-center">
        <b className="text-plum">No UPI ID to pay yet</b>
        <p className="a-sub">The moderators haven&apos;t added a UPI ID that can take money for {firstName}. Check back soon.</p>
      </div>
    );
  }

  const qrSrc = surprise.upi.qrImageUrl ?? qr;

  return (
    <div className="flex flex-col gap-3">
      <ScratchCard revealed={scratched} onReveal={() => setScratched(true)}>
        <div className="flex flex-col items-center gap-2 p-3.5 text-center">
          <span className="label">Scan with any UPI app</span>
          {qrSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrSrc} alt={`UPI QR code to pay ${surprise.upi.payeeName}`} width={150} height={150} className="h-[150px] w-[150px] object-contain" />
          ) : (
            <div className="h-[150px] w-[150px]" />
          )}
          <span className="font-mono text-[13px] text-plum">{surprise.upi.upiId}</span>
          <span className="hint -mt-1.5">Pay to {surprise.upi.payeeName}</span>
          {surprise.amountMode !== "any" && surprise.amount != null && (
            <span className="font-display text-[26px] font-extrabold text-plum">
              {formatRupees(surprise.amount)}
              {surprise.amountMode === "suggested" && <small className="ml-1 font-sans text-xs font-medium text-muted">suggested</small>}
            </span>
          )}
        </div>
      </ScratchCard>

      {scratched && (
        <div className="pop-in flex flex-col gap-3">
          {surprise.amountMode !== "fixed" && (
            <div>
              <label htmlFor="pay-amount" className="label">
                Your amount (₹)
              </label>
              <input
                id="pay-amount"
                className="field"
                type="number"
                inputMode="numeric"
                min={1}
                max={100000}
                value={amount ?? ""}
                placeholder={surprise.amountMode === "any" ? "Any amount" : undefined}
                onChange={(e) => onAmount(e.target.value === "" ? null : Math.max(1, Math.round(Number(e.target.value))))}
              />
            </div>
          )}
          <a href={link ?? "#"} className="btn">
            {payAmount ? `Pay ${formatRupees(payAmount)} with a UPI app` : "Pay with a UPI app"}
          </a>
          <p className="hint -mt-1 text-center">Opens GPay, PhonePe, Paytm or your bank app. On a laptop, scan the QR instead.</p>
          {surprise.allUpiFull && <p className="hint">Every UPI ID has its share of payers, so you got the least busy one. The moderators know.</p>}
        </div>
      )}
    </div>
  );
}

function PoolCard({ celebrationId, isAdmin, surprise, amount }: { celebrationId: string; isAdmin: boolean; surprise: Surprise | null; amount: number | null }) {
  const pool = useAsync(() => data.getPool(celebrationId), [celebrationId]);
  const payers = useAsync(() => (isAdmin ? data.getPayers(celebrationId) : Promise.resolve([])), [celebrationId, isAdmin]);
  const [paidAt, setPaidAt] = useState<string | null>(surprise?.myPaidAt ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reloadPool = pool.reload;
  const reloadPayers = payers.reload;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPaidAt(surprise?.myPaidAt ?? null);
  }, [surprise?.myPaidAt]);

  useEffect(
    () =>
      data.onPoolChange(celebrationId, () => {
        reloadPool();
        reloadPayers();
      }),
    [celebrationId, reloadPool, reloadPayers],
  );

  async function togglePaid(next: boolean) {
    if (!surprise) return;
    setSaving(true);
    setError(null);
    try {
      await data.markPaid(surprise.celebrationId, next, surprise.amountMode === "fixed" ? null : amount);
      setPaidAt(next ? new Date().toISOString() : null);
      if (next) celebrate();
      reloadPool();
      reloadPayers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  const p = pool.data;
  if (!p) return null;
  const pct = p.eligibleCount ? Math.round((p.paidCount / p.eligibleCount) * 100) : 0;

  return (
    <>
      <section aria-labelledby="pool" className="card flex flex-col gap-2">
        <div className="flex justify-between gap-2 text-[13px]">
          <h2 id="pool" className="font-sans text-[13px] font-bold text-ink">
            Class pool
          </h2>
          <span>
            {p.paidCount} of {p.eligibleCount} chipped in · {formatRupees(p.totalAmount)}
          </span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={p.paidCount}
          aria-valuemin={0}
          aria-valuemax={p.eligibleCount}
          aria-label="People who chipped in"
        >
          <i className="block h-full rounded-full bg-mint transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        {surprise?.upi && (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold text-ink">
            <input type="checkbox" className="h-5 w-5 accent-[var(--mint)]" checked={Boolean(paidAt)} disabled={saving} onChange={(e) => togglePaid(e.target.checked)} />
            {paidAt ? "You've chipped in 🎉" : "I've chipped in"}
          </label>
        )}
        {surprise?.upi && <p className="hint -mt-1.5">Tick this after paying. UPI doesn&apos;t tell bdap, so it&apos;s on your word.</p>}
        <ErrorNote>{error}</ErrorNote>
      </section>

      {isAdmin && payers.data && payers.data.length > 0 && (
        <section aria-labelledby="payers" className="card">
          <div className="flex items-center justify-between">
            <h2 id="payers" className="label">
              Who paid
            </h2>
            <span className="pill">Moderators only</span>
          </div>
          <ul className="dashed-list mt-1">
            {payers.data.map((x) => (
              <li key={x.userId} className="grid grid-cols-[36px_1fr_auto] items-center gap-2.5 py-2.5">
                <Avatar name={x.fullName} />
                <div className="min-w-0 text-sm font-bold text-ink">
                  <span className="block truncate">{x.fullName}</span>
                  <small className="block truncate text-xs font-normal text-muted">{x.upiId ?? "Hasn't opened it yet"}</small>
                </div>
                <span className={`pill ${x.paidAt ? "pill-mint" : ""}`}>{x.paidAt ? `✓ ${x.amount ? formatRupees(x.amount) : "Paid"}` : "Not yet"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
