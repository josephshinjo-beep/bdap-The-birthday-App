"use client";
import Link from "next/link";
import { AuthGate } from "@/components/auth-gate";
import { PushPrompt } from "@/components/push-prompt";
import { EmptyState, Loading, Page, roleLabel } from "@/components/ui";
import { data } from "@/lib/data";
import { useAsync } from "@/lib/use-async";
import type { Session } from "@/lib/types";

export function RoomsView() {
  return <AuthGate>{(s) => <Rooms session={s} />}</AuthGate>;
}

function Rooms({ session }: { session: Session }) {
  const rooms = useAsync(() => data.myRooms(), [session.userId]);
  const first = session.profile?.fullName.split(" ")[0];

  return (
    <Page>
      <h1 className="enter font-display text-3xl font-extrabold">Hey {first} 👋</h1>
      <p className="enter-2 text-muted">Your class, hostel and club rooms.</p>
      <div className="mt-4">
        <PushPrompt />
      </div>
      <div className="mt-4">
        {rooms.loading ? (
          <Loading />
        ) : !rooms.data?.length ? (
          <EmptyState
            title="No rooms yet"
            action={
              <div className="flex flex-col justify-center gap-2 sm:flex-row">
                <Link href="/join" className="btn">Join with a code</Link>
                <Link href="/create" className="btn-ghost">Create a room</Link>
              </div>
            }
          >
            Join your class with the code your rep shared, or start a room yourself.
          </EmptyState>
        ) : (
          <ul className="grid gap-3">
            {rooms.data.map((r) => (
              <li key={r.id}>
                <Link href={r.myStatus === "pending" ? `/rooms/${r.id}/waiting` : `/rooms/${r.id}`} className="card flex items-center justify-between gap-3 p-4">
                  <span>
                    <span className="block font-display text-xl font-bold">{r.name}</span>
                    <span className="text-sm text-muted">{r.myStatus === "pending" ? "Waiting for approval" : roleLabel(r.myRole)}</span>
                  </span>
                  <span aria-hidden="true" className="text-2xl">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {rooms.data && rooms.data.length > 0 && (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link href="/join" className="btn-ghost">Join another room</Link>
          <Link href="/create" className="btn-ghost">Create a room</Link>
        </div>
      )}
    </Page>
  );
}
