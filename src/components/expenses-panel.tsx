"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { data } from "@/lib/data";
import { celebrate } from "@/lib/confetti";
import { formatISODayMonth, todayIST } from "@/lib/dates";
import { checkContribution, splitAmount } from "@/lib/split";
import { useAsync } from "@/lib/use-async";
import { buildUpiLink, formatRupees } from "@/lib/upi";
import { isAdminRole, isRepRole, type Expense, type Room } from "@/lib/types";
import { PayersList } from "./payers-list";
import { EmptyState, ErrorNote, Loading } from "./ui";

const STATUS: Record<Expense["status"], { label: string; cls: string }> = {
  requested: { label: "Waiting for approval", cls: "pill-pink" },
  approved: { label: "Collecting", cls: "pill-mint" },
  declined: { label: "Declined", cls: "" },
  closed: { label: "Closed", cls: "pill-sun" },
};

/**
 * Class expenses (not just birthdays): class reps request a split, a moderator
 * approves it, then everyone pays their equal share. Reps record who paid.
 */
export function ExpensesPanel({ room, memberCount }: { room: Room; memberCount: number }) {
  const expenses = useAsync(() => data.listExpenses(room.id), [room.id]);
  const isRep = isRepRole(room.myRole);
  const isAdmin = isAdminRole(room.myRole);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex flex-col gap-3.5">
      {isRep && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="hint max-w-md">
            {isAdmin ? "Your splits go out to the class straight away." : "As a class rep, your splits go to a moderator for approval before the class sees them."}
          </p>
          {!showForm && (
            <button type="button" className="btn btn-sm" onClick={() => setShowForm(true)}>
              + New split
            </button>
          )}
        </div>
      )}
      {showForm && (
        <ExpenseForm
          room={room}
          memberCount={memberCount}
          onDone={() => {
            setShowForm(false);
            expenses.reload();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
      {expenses.loading ? (
        <Loading />
      ) : !expenses.data?.length ? (
        <EmptyState title="No class expenses yet">
          {isRep ? "Start a split for a trip, printouts, a gift — anything the class shares." : "When a class rep starts a split (a trip, printouts…), it shows up here."}
        </EmptyState>
      ) : (
        <ul className="grid gap-3.5 lg:grid-cols-2">
          {expenses.data.map((e) => (
            <li key={e.id}>
              <ExpenseCard expense={e} room={room} isRep={isRep} isAdmin={isAdmin} reload={expenses.reload} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExpenseCard({ expense: e, room, isRep, isAdmin, reload }: { expense: Expense; room: Room; isRep: boolean; isAdmin: boolean; reload: () => void }) {
  const [open, setOpen] = useState<"pay" | "record" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = STATUS[e.status];
  const pct = e.eligibleCount ? Math.round((e.paidCount / e.eligibleCount) * 100) : 0;
  const overdue = e.status === "approved" && e.dueDate && e.dueDate < todayIST() && !e.myPaidAt;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`card flex h-full flex-col gap-2.5 ${e.status === "requested" ? "border-accent" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold text-plum">{e.title}</h3>
          {e.purpose && <p className="text-[13px] text-muted">{e.purpose}</p>}
        </div>
        <span className={`pill ${status.cls}`}>{status.label}</span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span>
          Total <b className="text-plum">{formatRupees(e.totalAmount)}</b>
        </span>
        {e.splitAmount != null && (
          <span>
            Each <b className="text-plum">{formatRupees(e.splitAmount)}</b>
          </span>
        )}
        {e.dueDate && (
          <span className={overdue ? "font-bold text-danger" : ""}>
            Due {formatISODayMonth(e.dueDate)}
            {overdue && " · overdue"}
          </span>
        )}
      </div>
      {e.createdByName && <p className="hint">Requested by {e.createdByName}</p>}

      {(e.status === "approved" || e.status === "closed") && (
        <>
          <div className="flex justify-between text-[13px]">
            <span>
              {e.paidCount} of {e.eligibleCount} paid
            </span>
            <span>{formatRupees(e.collected)} collected</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={e.paidCount} aria-valuemin={0} aria-valuemax={e.eligibleCount} aria-label={`${e.title}: people who paid`}>
            <i className="block h-full rounded-full bg-mint" style={{ width: `${pct}%` }} />
          </div>
        </>
      )}

      {e.status === "approved" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={e.myPaidAt ? "btn-ok btn-sm" : "btn btn-sm"} onClick={() => setOpen(open === "pay" ? null : "pay")} aria-expanded={open === "pay"}>
            {e.myPaidAt ? "✓ You've paid" : `Pay ${e.splitAmount ? formatRupees(e.splitAmount) : ""}`}
          </button>
          {isRep && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(open === "record" ? null : "record")} aria-expanded={open === "record"}>
              Record payments
            </button>
          )}
        </div>
      )}

      {open === "pay" && e.status === "approved" && <PayBox expense={e} roomName={room.name} onDone={reload} />}
      {open === "record" && <RecordBox expense={e} onChanged={reload} />}

      {isAdmin && e.status === "requested" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ok btn-sm" disabled={busy} onClick={() => run(() => data.decideExpense(e.id, true))}>
            Approve split
          </button>
          <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => run(() => data.decideExpense(e.id, false))}>
            Decline
          </button>
        </div>
      )}
      {isAdmin && e.status === "approved" && (
        <button type="button" className="btn-secondary btn-sm self-start" disabled={busy} onClick={() => run(() => data.closeExpense(e.id))}>
          Close collection
        </button>
      )}
      {(isAdmin || (isRep && e.status === "requested")) &&
        (confirmDelete ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-sm !border-danger !text-danger" disabled={busy} onClick={() => run(() => data.deleteExpense(e.id))}>
              Delete for good
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>
              Keep
            </button>
          </div>
        ) : (
          <button type="button" className="min-h-10 self-start text-[13px] font-bold text-danger" onClick={() => setConfirmDelete(true)}>
            {isAdmin ? "Delete" : "Withdraw request"}
          </button>
        ))}
      <ErrorNote>{error}</ErrorNote>
    </article>
  );
}

function PayBox({ expense: e, roomName, onDone }: { expense: Expense; roomName: string; onDone: () => void }) {
  const [amount, setAmount] = useState<number | null>(e.myAmount ?? e.splitAmount);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooLow = checkContribution(amount, e.splitAmount);
  const link = e.upi ? buildUpiLink({ upiId: e.upi.upiId, payeeName: e.upi.payeeName, amount, note: `${e.title} ${roomName}`.slice(0, 50) }) : null;

  useEffect(() => {
    if (!link || e.upi?.qrImageUrl) return;
    let live = true;
    QRCode.toDataURL(link, { margin: 1, width: 360, color: { dark: "#2a1f4f", light: "#ffffff" } }).then((u) => live && setQr(u)).catch(() => {});
    return () => {
      live = false;
    };
  }, [link, e.upi?.qrImageUrl]);

  async function toggle(paid: boolean) {
    if (paid && tooLow) return setError(tooLow);
    setBusy(true);
    setError(null);
    try {
      await data.markExpensePaid(e.id, paid, amount);
      if (paid) celebrate();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pop-in flex flex-col gap-2.5 rounded-md border-2 border-dashed border-accent p-3">
      {e.upi ? (
        <div className="flex items-center gap-3">
          {(e.upi.qrImageUrl ?? qr) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.upi.qrImageUrl ?? qr!} alt={`UPI QR to pay ${e.upi.payeeName}`} width={110} height={110} className="h-[110px] w-[110px] rounded-sm" />
          )}
          <div className="min-w-0 text-sm">
            <p className="font-mono text-[13px] text-plum">{e.upi.upiId}</p>
            <p className="hint">Pay to {e.upi.payeeName}</p>
          </div>
        </div>
      ) : (
        <p className="hint">No UPI ID set for this split. Pay the class rep directly.</p>
      )}
      <div>
        <label htmlFor={`amt-${e.id}`} className="label">Your amount (₹)</label>
        <input
          id={`amt-${e.id}`}
          className="field"
          type="number"
          inputMode="numeric"
          min={e.splitAmount ?? 1}
          value={amount ?? ""}
          aria-invalid={tooLow ? true : undefined}
          onChange={(ev) => setAmount(ev.target.value === "" ? null : Math.round(Number(ev.target.value)))}
        />
        <p className="hint mt-1">Your equal share is {e.splitAmount ? formatRupees(e.splitAmount) : "—"}. You can give more, not less.</p>
        <ErrorNote>{tooLow && amount != null ? tooLow : null}</ErrorNote>
      </div>
      {link && (
        <a href={tooLow ? undefined : link} aria-disabled={tooLow ? true : undefined} className={`btn btn-sm ${tooLow ? "pointer-events-none opacity-50" : ""}`}>
          Pay {amount ? formatRupees(amount) : ""} with a UPI app
        </a>
      )}
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold text-ink">
        <input type="checkbox" className="h-5 w-5 accent-[var(--mint)]" checked={Boolean(e.myPaidAt)} disabled={busy} onChange={(ev) => toggle(ev.target.checked)} />
        {e.myPaidAt ? "You've paid 🎉" : "I've paid"}
      </label>
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}

function RecordBox({ expense: e, onChanged }: { expense: Expense; onChanged: () => void }) {
  const payers = useAsync(() => data.getExpensePayers(e.id), [e.id]);
  if (payers.loading) return <Loading />;
  return (
    <PayersList
      payers={payers.data ?? []}
      split={e.splitAmount}
      title={`Who paid for ${e.title}`}
      onRecord={async (userId, paid) => {
        await data.recordExpensePayment(e.id, userId, paid);
        payers.reload();
        onChanged();
      }}
    />
  );
}

function ExpenseForm({ room, memberCount, onDone, onCancel }: { room: Room; memberCount: number; onDone: () => void; onCancel: () => void }) {
  const choices = useAsync(() => data.listUpiChoices(room.id), [room.id]);
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [total, setTotal] = useState("");
  const [upi, setUpi] = useState<string>("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totalNum = total ? Math.round(Number(total)) : null;
  const split = splitAmount(totalNum, memberCount);
  const selected = upi || choices.data?.[0]?.id || "";

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!title.trim() || !totalNum || totalNum < 1) return setError("Add a title and a total.");
    setBusy(true);
    setError(null);
    try {
      await data.requestExpense(room.id, { title: title.trim(), purpose: purpose.trim() || null, totalAmount: totalNum, upiAccountId: selected || null, dueDate: due || null });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send it.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card pop-in flex flex-col gap-3" noValidate>
      <h3 className="label">New split</h3>
      <div>
        <label htmlFor="exp-title" className="label">What is it?</label>
        <input id="exp-title" className="field" maxLength={80} placeholder="Industrial visit bus, lab printouts…" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label htmlFor="exp-purpose" className="label">Details (optional)</label>
        <input id="exp-purpose" className="field" maxLength={200} placeholder="What the money covers" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="exp-total" className="label">Total (₹)</label>
          <input id="exp-total" className="field" type="number" inputMode="numeric" min={1} value={total} onChange={(e) => setTotal(e.target.value)} aria-describedby="exp-split" />
        </div>
        <div>
          <label htmlFor="exp-due" className="label">Due date (optional)</label>
          <input id="exp-due" className="field" type="date" min={todayIST()} value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>
      <p id="exp-split" className="rounded-sm bg-[var(--pill-mint-bg)] px-3 py-2 text-sm text-[var(--pill-mint-ink)]" aria-live="polite">
        {split ? (
          <>
            Split equally: <b>{formatRupees(split)} each</b> for {memberCount} people. Nobody can pay less.
          </>
        ) : (
          "Enter the total to see each person's share."
        )}
      </p>
      <div>
        <label htmlFor="exp-upi" className="label">Collect on</label>
        <select id="exp-upi" className="field" value={selected} onChange={(e) => setUpi(e.target.value)} disabled={choices.loading}>
          {(choices.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.upiId} · {c.payeeName}
            </option>
          ))}
          <option value="">No UPI ID (pay the rep directly)</option>
        </select>
      </div>
      <ErrorNote>{error}</ErrorNote>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "Sending…" : isAdminRole(room.myRole) ? "Start the split" : "Send for approval"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
