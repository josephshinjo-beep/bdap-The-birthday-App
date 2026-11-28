"use client";
import { useState } from "react";
import { data } from "@/lib/data";
import { useAsync } from "@/lib/use-async";
import { formatRupees } from "@/lib/upi";
import type { Poll, PollOptionInput } from "@/lib/types";
import { ErrorNote, Loading } from "./ui";
import { TrophyIcon } from "@/components/icons";

/**
 * The vote for a celebration (e.g. cake flavour). Members vote; admins can
 * create it, close it (the winner's price becomes the total) or delete it.
 */
export function PollCard({ celebrationId, canManage, onChanged }: { celebrationId: string; canManage: boolean; onChanged?: () => void }) {
  const poll = useAsync(() => data.getPoll(celebrationId), [celebrationId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      poll.reload();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  if (poll.loading) return <Loading label="Loading the vote" />;
  if (!poll.data) {
    return canManage ? <PollBuilder onCreate={(q, opts) => run(() => data.createPoll(celebrationId, q, opts))} busy={busy} error={error} /> : null;
  }
  return <PollView poll={poll.data} canManage={canManage} busy={busy} error={error} run={run} />;
}

function PollView({ poll, canManage, busy, error, run }: { poll: Poll; canManage: boolean; busy: boolean; error: string | null; run: (fn: () => Promise<void>) => Promise<void> }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const open = poll.status === "open";
  const max = Math.max(1, ...poll.options.map((o) => o.votes));

  return (
    <section aria-labelledby={`poll-${poll.id}`} className="card flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 id={`poll-${poll.id}`} className="label">Vote</h2>
        <span className={`pill ${open ? "pill-mint" : ""}`}>{open ? `Open · ${poll.totalVotes} votes` : `Closed · ${poll.totalVotes} votes`}</span>
      </div>
      <p className="font-display text-lg font-bold text-plum">{poll.question}</p>
      <ul className="flex flex-col gap-2" role={open ? "radiogroup" : undefined} aria-label={poll.question}>
        {poll.options.map((o) => {
          const mine = poll.myVote === o.id;
          const winner = poll.winnerOptionId === o.id;
          return (
            <li key={o.id}>
              <button
                type="button"
                role={open ? "radio" : undefined}
                aria-checked={open ? mine : undefined}
                disabled={!open || busy}
                onClick={() => run(() => data.votePoll(poll.id, o.id))}
                className={`relative w-full overflow-hidden rounded-md border-2 px-3 py-2.5 text-left transition-colors ${
                  mine || winner ? "border-plum" : "border-line"
                } ${open ? "hover:border-plum" : "cursor-default"}`}
              >
                <span aria-hidden="true" className={`absolute inset-y-0 left-0 ${winner ? "bg-[var(--pill-sun-bg)]" : "bg-[var(--pill-mint-bg)]"}`} style={{ width: `${(o.votes / max) * 100}%` }} />
                <span className="relative flex items-center justify-between gap-2">
                  <span className="font-bold text-plum">
                    {winner && <TrophyIcon className="mr-1 text-sun-deep" />}
                    {o.label}
                    {mine && <span className="ml-1.5 text-xs font-bold text-ok">✓ your vote</span>}
                  </span>
                  <span className="shrink-0 text-sm text-muted">
                    {o.price != null && <b className="mr-2 text-plum">{formatRupees(o.price)}</b>}
                    {o.votes}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {open && !poll.myVote && <p className="hint">Tap an option to vote. You can change your vote until it closes.</p>}
      {!open && <p className="hint">The winner&apos;s price became the total expense, split equally.</p>}
      {canManage && (
        <div className="flex flex-wrap gap-2">
          {open && (
            <button type="button" className="btn btn-sm" disabled={busy || poll.totalVotes === 0} onClick={() => run(() => data.closePoll(poll.id))}>
              Close vote and use the winner
            </button>
          )}
          {confirmDelete ? (
            <>
              <button type="button" className="btn-secondary btn-sm !border-danger !text-danger" disabled={busy} onClick={() => run(() => data.deletePoll(poll.id))}>
                Delete vote
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>Keep</button>
            </>
          ) : (
            <button type="button" className="btn-secondary btn-sm" onClick={() => setConfirmDelete(true)}>Delete</button>
          )}
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
    </section>
  );
}

function PollBuilder({ onCreate, busy, error }: { onCreate: (question: string, options: PollOptionInput[]) => void; busy: boolean; error: string | null }) {
  const [question, setQuestion] = useState("Which cake should we get?");
  const [options, setOptions] = useState<{ label: string; price: string }[]>([
    { label: "Chocolate truffle", price: "" },
    { label: "Red velvet", price: "" },
  ]);
  const valid = question.trim() && options.filter((o) => o.label.trim()).length >= 2;

  return (
    <section aria-labelledby="poll-new" className="card flex flex-col gap-2.5">
      <h2 id="poll-new" className="label">Start a vote (e.g. cake flavour)</h2>
      <div>
        <label htmlFor="poll-q" className="label">Question</label>
        <input id="poll-q" className="field" maxLength={120} value={question} onChange={(e) => setQuestion(e.target.value)} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-1">Options and prices</legend>
        {options.map((o, i) => (
          <div key={i} className="flex gap-2">
            <label className="sr-only" htmlFor={`opt-${i}`}>Option {i + 1}</label>
            <input id={`opt-${i}`} className="field flex-1" placeholder={`Option ${i + 1}`} maxLength={60} value={o.label} onChange={(e) => setOptions((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <label className="sr-only" htmlFor={`price-${i}`}>Price for option {i + 1}</label>
            <input
              id={`price-${i}`}
              className="field w-28"
              type="number"
              inputMode="numeric"
              placeholder="₹ price"
              min={1}
              value={o.price}
              onChange={(e) => setOptions((l) => l.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
            />
            {options.length > 2 && (
              <button type="button" className="btn-secondary btn-sm" aria-label={`Remove option ${i + 1}`} onClick={() => setOptions((l) => l.filter((_, j) => j !== i))}>
                ✕
              </button>
            )}
          </div>
        ))}
        {options.length < 8 && (
          <button type="button" className="btn-secondary btn-sm self-start" onClick={() => setOptions((l) => [...l, { label: "", price: "" }])}>
            + Add option
          </button>
        )}
      </fieldset>
      <p className="hint">When you close the vote, the winning option&apos;s price becomes the total expense and the split updates.</p>
      <button
        type="button"
        className="btn"
        disabled={!valid || busy}
        onClick={() =>
          onCreate(
            question.trim(),
            options.filter((o) => o.label.trim()).map((o) => ({ label: o.label.trim(), price: o.price ? Math.round(Number(o.price)) : null })),
          )
        }
      >
        Start the vote
      </button>
      <ErrorNote>{error}</ErrorNote>
    </section>
  );
}
