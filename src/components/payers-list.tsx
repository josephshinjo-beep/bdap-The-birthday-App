"use client";
import { useState } from "react";
import { formatRupees } from "@/lib/upi";
import type { Payer } from "@/lib/types";
import { Avatar, ErrorNote } from "./ui";

/**
 * Who paid, for admins and class reps. With `onRecord`, reps can mark
 * someone as paid (e.g. cash handed over) or undo it.
 */
export function PayersList({
  payers,
  split,
  onRecord,
  title = "Who paid",
}: {
  payers: Payer[];
  split: number | null;
  onRecord?: (userId: string, paid: boolean) => Promise<void>;
  title?: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paidCount = payers.filter((p) => p.paidAt).length;

  async function record(p: Payer) {
    if (!onRecord) return;
    setBusy(p.userId);
    setError(null);
    try {
      await onRecord(p.userId, !p.paidAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't record that.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="label">{title}</h2>
        <span className="pill">
          {paidCount}/{payers.length} paid
        </span>
      </div>
      {onRecord && <p className="hint mt-1">Tap “Record” when someone pays you in cash or you&apos;ve checked their UPI payment.</p>}
      <ErrorNote>{error}</ErrorNote>
      <ul className="dashed-list mt-1">
        {payers.map((x) => (
          <li key={x.userId} className="grid grid-cols-[36px_1fr_auto] items-center gap-2.5 py-2.5">
            <Avatar name={x.fullName} />
            <div className="min-w-0 text-sm font-bold text-ink">
              <span className="block truncate">{x.fullName}</span>
              <small className="block truncate text-xs font-normal text-muted">
                {x.paidAt ? `${formatRupees(x.amount ?? split ?? 0)}${x.recordedBy ? " · recorded by a rep" : " · self-reported"}` : x.upiId ?? "Not paid yet"}
              </small>
            </div>
            {onRecord ? (
              <button
                type="button"
                className={x.paidAt ? "btn-ok btn-sm" : "btn-secondary btn-sm"}
                disabled={busy !== null}
                aria-pressed={Boolean(x.paidAt)}
                aria-label={x.paidAt ? `Mark ${x.fullName} as not paid` : `Record payment from ${x.fullName}`}
                onClick={() => record(x)}
              >
                {busy === x.userId ? "…" : x.paidAt ? "✓ Paid" : "Record"}
              </button>
            ) : (
              <span className={`pill ${x.paidAt ? "pill-mint" : ""}`}>{x.paidAt ? "✓ Paid" : "Not yet"}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
