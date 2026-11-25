"use client";
import Link from "next/link";
import { AuthGate } from "@/components/auth-gate";
import { PushPrompt } from "@/components/push-prompt";
import { EmptyState, Loading, Page, RoomBadge, roleLabel } from "@/components/ui";
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
      <h1 className="a-h enter">
        Hey <em>{first}</em> 👋
      </h1>
      <p className="a-sub enter-2">Your class, hostel and club rooms.</p>
      <PushPrompt />
      {rooms.loading ? (
        <Loading />
      ) : !rooms.data?.length ? (
        <EmptyState
          title="No rooms yet"
          action={
            <div className="flex flex-col gap-2">
              <Link href="/join" className="btn">Join your class room</Link>
              <Link href="/create" className="btn-secondary">Create a room</Link>
            </div>
          }
        >
          Join your class with the code your moderator shared, or start a room yourself.
        </EmptyState>
      ) : (
        <>
          <span className="label">Your rooms</span>
          <ul className="flex flex-col gap-2">
            {rooms.data.map((r) => (
              <li key={r.id}>
                <Link href={r.myStatus === "pending" ? `/rooms/${r.id}/waiting` : `/rooms/${r.id}`} className="card flex items-center gap-2.5">
                  <RoomBadge name={r.name} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-plum">{r.name}</b>
                    <span className="hint">{r.myStatus === "pending" ? "Waiting for approval" : roleLabel(r.myRole)}</span>
                  </span>
                  {r.myStatus === "pending" ? <span className="pill pill-sun">Pending</span> : <span aria-hidden="true" className="text-plum">→</span>}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/join" className="btn">Join another room</Link>
          <Link href="/create" className="btn-secondary">Create a room</Link>
        </>
      )}
    </Page>
  );
}
