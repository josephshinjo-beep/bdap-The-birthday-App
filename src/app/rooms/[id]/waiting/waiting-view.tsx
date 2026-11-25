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

/** The sun envelope from the blueprint, bobbing while you wait. */
function Envelope() {
  return (
    <div aria-hidden="true" className="bob relative mt-4 h-[84px] w-[120px] self-center rounded-sm bg-sun">
      <div className="absolute inset-0 rounded-sm bg-sun-deep" style={{ clipPath: "polygon(0 0,100% 0,50% 58%)" }} />
    </div>
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

  if (room.loading) return <Page><Loading /></Page>;
  if (!room.data) {
    return (
      <Page>
        <p className="mt-10 text-center a-sub">
          This request isn&apos;t here any more. <Link href="/join" className="font-bold text-plum underline">Try the code again</Link>.
        </p>
      </Page>
    );
  }

  const steps: { label: string; state: "done" | "now" | "todo" }[] = [
    { label: `Code checked · ${room.data.name}`, state: "done" },
    { label: "Details sent", state: "done" },
    { label: "Waiting for moderator", state: current === "approved" ? "done" : current === "pending" ? "now" : "todo" },
    { label: "Welcome to the room", state: current === "approved" ? "done" : "todo" },
  ];

  return (
    <Page>
      <Envelope />
      <h1 className="a-h text-center">
        {current === "approved" ? (
          <>You&apos;re <em>in!</em></>
        ) : current === "declined" ? (
          <>Request <em>declined</em></>
        ) : (
          <>Request sent to <em>{room.data.name}</em></>
        )}
      </h1>
      <p className="a-sub text-center" aria-live="polite">
        {current === "approved"
          ? `Taking you to ${room.data.name}…`
          : current === "declined"
            ? "The moderator declined this request. If that's a mistake, ask them and try again."
            : "You'll get in as soon as your moderator approves. This page moves on by itself."}
      </p>

      <ol className="card flex flex-col gap-2.5">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 text-sm">
            <i
              aria-hidden="true"
              className={`h-3.5 w-3.5 flex-none rounded-full border-2 ${
                s.state === "done" ? "border-mint bg-mint" : s.state === "now" ? "pulse-ring border-accent bg-white" : "border-line bg-line"
              }`}
            />
            <span className={s.state === "todo" ? "text-muted" : "text-ink"}>{s.label}</span>
            <span className="sr-only">{s.state === "done" ? "(done)" : s.state === "now" ? "(in progress)" : ""}</span>
          </li>
        ))}
      </ol>

      {current === "declined" ? <Link href="/join" className="btn">Enter a code</Link> : <Link href="/rooms" className="btn-secondary">Back to my rooms</Link>}
    </Page>
  );
}
