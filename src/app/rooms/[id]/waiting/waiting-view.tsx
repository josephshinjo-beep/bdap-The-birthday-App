"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { Loading, Page } from "@/components/ui";
import { data } from "@/lib/data";
import { celebrate } from "@/lib/confetti";
import { useAsync } from "@/lib/use-async";
import type { MemberStatus } from "@/lib/types";

export function WaitingView() {
  return <AuthGate>{() => <Waiting />}</AuthGate>;
}

function Envelope() {
  return (
    <svg width="150" height="120" viewBox="0 0 150 120" aria-hidden="true" className="bob">
      <rect x="8" y="22" width="134" height="90" rx="10" fill="var(--surface)" stroke="var(--ink)" strokeWidth="4" />
      <path d="M10 28 L75 74 L140 28" fill="var(--sun)" stroke="var(--ink)" strokeWidth="4" strokeLinejoin="round" />
      <path d="M10 108 L58 64 M140 108 L92 64" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="75" cy="72" r="11" fill="var(--accent)" stroke="var(--ink)" strokeWidth="4" />
      <path d="M71 72 l3 3 l6 -6" stroke="var(--ink)" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Waiting() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const room = useAsync(() => data.getRoom(id), [id]);
  const [status, setStatus] = useState<MemberStatus | null>(null);
  const current = status ?? room.data?.myStatus ?? null;

  useEffect(() => data.onMembershipChange(id, setStatus), [id]);

  useEffect(() => {
    if (current !== "approved") return;
    celebrate();
    const t = setTimeout(() => router.replace(`/rooms/${id}`), 1600);
    return () => clearTimeout(t);
  }, [current, id, router]);

  if (room.loading) return <Page narrow><Loading /></Page>;
  if (!room.data) {
    return (
      <Page narrow>
        <p className="mt-10 text-center">This request isn&apos;t here any more. <Link href="/join" className="font-bold underline">Try the code again</Link>.</p>
      </Page>
    );
  }

  const steps = [
    { label: "Code checked", done: true },
    { label: "Details sent", done: true },
    { label: `Waiting for the moderator`, done: current === "approved", active: current === "pending" },
    { label: "Welcome in!", done: current === "approved" },
  ];

  return (
    <Page narrow>
      <div className="mt-8 flex flex-col items-center text-center">
        <Envelope />
        <h1 className="mt-4 font-display text-3xl font-extrabold">
          {current === "approved" ? "You're in! 🎉" : current === "declined" ? "Request declined" : "Request sent"}
        </h1>
        <p className="mt-1 max-w-sm text-muted" aria-live="polite">
          {current === "approved"
            ? `Taking you to ${room.data.name}…`
            : current === "declined"
              ? `The moderator of ${room.data.name} declined this request. If that's a mistake, ask them and try again.`
              : `A moderator of ${room.data.name} will let you in soon. This page updates by itself.`}
        </p>
      </div>

      <ol className="card mx-auto mt-8 max-w-sm space-y-0 p-5">
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex items-start gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden="true" className={`absolute left-[13px] top-7 h-[calc(100%-20px)] w-0.5 ${s.done ? "bg-mint" : "bg-line"}`} />}
            <span
              aria-hidden="true"
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-ink text-sm font-bold ${s.done ? "bg-mint text-[#221b3a]" : s.active ? "bg-sun pulse-dot text-[#221b3a]" : "bg-surface"}`}
            >
              {s.done ? "✓" : i + 1}
            </span>
            <span className={`pt-0.5 font-bold ${s.done || s.active ? "" : "text-muted"}`}>
              {s.label}
              <span className="sr-only">{s.done ? " (done)" : s.active ? " (in progress)" : ""}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6 text-center">
        {current === "declined" ? <Link href="/join" className="btn">Enter a code</Link> : <Link href="/rooms" className="btn-ghost">Back to my rooms</Link>}
      </div>
    </Page>
  );
}
