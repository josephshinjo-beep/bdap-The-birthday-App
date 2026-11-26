"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { PayersList } from "@/components/payers-list";
import { PollCard } from "@/components/poll-card";
import { BackLink, Columns, EmptyState, ErrorNote, Loading, Page } from "@/components/ui";
import { data } from "@/lib/data";
import { daysBetween, formatISODayMonth, relativeDays, todayIST } from "@/lib/dates";
import { splitAmount } from "@/lib/split";
import { useAsync } from "@/lib/use-async";
import { formatRupees } from "@/lib/upi";
import { isAdminRole, type Celebration, type Room, type Session } from "@/lib/types";

export function PlanView() {
  return <AuthGate>{(s) => <PlanLoader session={s} />}</AuthGate>;
}

function PlanLoader({ session }: { session: Session }) {
  const { id, celebrationId } = useParams<{ id: string; celebrationId: string }>();
  const room = useAsync(() => data.getRoom(id), [id, session.userId]);
  const cel = useAsync(() => data.getCelebration(celebrationId), [celebrationId, session.userId]);

  if (room.loading || cel.loading) return <Page><Loading /></Page>;
  if (!room.data || !isAdminRole(room.data.myRole) || !cel.data) {
    return (
      <Page>
        <EmptyState title="Nothing here" action={<Link href={`/rooms/${id}`} className="btn w-full">Back to the room</Link>}>
          Only the room&apos;s admins can plan celebrations, and never their own.
        </EmptyState>
      </Page>
    );
  }
  return <Plan room={room.data} celebration={cel.data} reload={cel.reload} />;
}

function Plan({ room, celebration, reload }: { room: Room; celebration: Celebration; reload: () => void }) {
  const members = useAsync(() => data.listMembers(room.id), [room.id]);
  const payers = useAsync(() => (celebration.decision === "celebrate" ? data.getPayers(celebration.id) : Promise.resolve([])), [celebration.id, celebration.decision]);
  const [purpose, setPurpose] = useState(celebration.purpose ?? "");
  const [total, setTotal] = useState(celebration.totalExpense ? String(celebration.totalExpense) : "");
  const [plan, setPlan] = useState(celebration.plan ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = celebration.birthdayName.split(" ")[0];

  // Keep the form in step when the vote closes and sets a new total.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTotal(celebration.totalExpense ? String(celebration.totalExpense) : "");
    setPurpose(celebration.purpose ?? "");
  }, [celebration.totalExpense, celebration.purpose]);

  const payerCount = Math.max(1, (members.data ?? []).filter((m) => m.status === "approved").length - 1);
  const totalNum = total ? Math.round(Number(total)) : null;
  const split = splitAmount(totalNum, payerCount);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (totalNum != null && !(totalNum >= 1 && totalNum <= 1_000_000)) return setError("Enter a total between ₹1 and ₹10,00,000.");
    setSaving(true);
    setError(null);
    try {
      await data.setCelebrationDetails(celebration.id, { purpose: purpose.trim() || null, totalExpense: totalNum, plan: plan.trim() || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page size="wide">
      <BackLink href={`/rooms/${room.id}/manage?tab=birthdays`}>Birthdays</BackLink>
      <div>
        <span className={`pill ${celebration.decision === "celebrate" ? "pill-mint" : celebration.decision === "wish_only" ? "pill-sun" : "pill-pink"}`}>
          {celebration.decision === "celebrate" ? "Celebrating" : celebration.decision === "wish_only" ? "Wish only" : "Needs a decision"}
        </span>
        <h1 className="a-h mt-2">
          Plan <em>{first}&apos;s</em> birthday
        </h1>
        <p className="a-sub">
          {formatISODayMonth(celebration.date)} · {relativeDays(daysBetween(todayIST(), celebration.date))}. {first} never sees this page.
        </p>
      </div>

      <Columns
        stickySide={false}
        main={
          <>
            <form onSubmit={save} className="card flex flex-col gap-3.5" noValidate>
              <h2 className="label">What the money is for</h2>
              <div>
                <label htmlFor="purpose" className="label">What for</label>
                <input id="purpose" className="field" placeholder="Cake 🎂, a gift, decorations…" maxLength={120} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
              </div>
              <div>
                <label htmlFor="total" className="label">Total expense (₹)</label>
                <input id="total" className="field" type="number" inputMode="numeric" min={1} placeholder="e.g. 1050" value={total} onChange={(e) => setTotal(e.target.value)} aria-describedby="split-preview" />
                <p id="split-preview" className="mt-1.5 rounded-sm bg-[var(--pill-mint-bg)] px-3 py-2 text-sm text-[var(--pill-mint-ink)]" aria-live="polite">
                  {split ? (
                    <>
                      Split equally: <b>{formatRupees(split)} each</b> for {payerCount} people. Nobody can chip in less than {formatRupees(split)}.
                    </>
                  ) : (
                    "Add a total to split it equally. Leave it empty to use the room's amount setting."
                  )}
                </p>
              </div>
              <div>
                <label htmlFor="plan" className="label">The plan for the day</label>
                <textarea id="plan" className="field min-h-24" maxLength={500} placeholder="Cake cutting at 4:30 PM in the CSE lab. Wear something pink!" value={plan} onChange={(e) => setPlan(e.target.value)} />
                <p className="hint mt-1">Members see this on the surprise page. {first} sees it on their wall on the day, and it goes on the share card.</p>
              </div>
              <ErrorNote>{error}</ErrorNote>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? "Saving…" : saved ? "Saved ✓" : "Save plan"}
              </button>
            </form>

            <PollCard celebrationId={celebration.id} canManage onChanged={reload} />
          </>
        }
        side={
          <>
            {celebration.decision !== "celebrate" && (
              <div className="card card-danger text-[13px]">
                <b className="text-plum">Not approved yet.</b> Members won&apos;t see the plan, the vote or the collection until you choose Celebrate on the Birthdays tab.
              </div>
            )}
            <div className="flex flex-col gap-2">
              {celebration.decision === "celebrate" && (
                <Link href={`/rooms/${room.id}/surprise/${celebration.id}`} className="btn-secondary">
                  Open the surprise page
                </Link>
              )}
              <Link href={`/rooms/${room.id}/wall/${celebration.id}`} className="btn-secondary">
                See the birthday wall
              </Link>
            </div>
            {celebration.decision === "celebrate" &&
              (payers.loading ? (
                <Loading />
              ) : (
                <PayersList
                  payers={payers.data ?? []}
                  split={celebration.splitAmount}
                  onRecord={async (userId, paid) => {
                    await data.recordCelebrationPayment(celebration.id, userId, paid);
                    payers.reload();
                  }}
                />
              ))}
          </>
        }
      />
    </Page>
  );
}
