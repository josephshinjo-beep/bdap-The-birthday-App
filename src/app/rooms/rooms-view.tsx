"use client";
import Link from "next/link";
import { AuthGate } from "@/components/auth-gate";
import { PushPrompt } from "@/components/push-prompt";
import { EmptyState, Loading, Page, RoomBadge, roleLabel } from "@/components/ui";
import { data } from "@/lib/data";
import { useAsync } from "@/lib/use-async";
import type { Session } from "@/lib/types";
import { ChevronIcon } from "@/components/icons";

export function RoomsView() {
  return <AuthGate>{(s) => <Rooms session={s} />}</AuthGate>;
}

function Rooms({ session }: { session: Session }) {
  const rooms = useAsync(() => data.myRooms(), [session.userId]);
  const first = session.profile?.fullName.split(" ")[0];

  return (
    <Page size="wide">
      <h1 className="a-h enter">
        Hey <span className="hl">{first}</span>
      </h1>
      <p className="a-sub enter-2">Your class, hostel and club rooms.</p>
      <div className="lg:max-w-xl">
        <PushPrompt />
      </div>
      {rooms.loading ? (
        <Loading />
      ) : !rooms.data?.length ? (
        <div className="lg:max-w-xl">
          <EmptyState
            title="No rooms yet"
            action={
              <div className="flex flex-col gap-2">
                <Link href="/join" className="btn">
                  Join your class room
                </Link>
                <Link href="/create" className="btn-secondary">
                  Create a room
                </Link>
              </div>
            }
          >
            Join your class with the code your moderator shared, or start a room yourself.
          </EmptyState>
        </div>
      ) : (
        <>
          <span className="label">Your rooms</span>
          <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {rooms.data.map((r) => (
              <li key={r.id}>
                <Link href={r.myStatus === "pending" ? `/rooms/${r.id}/waiting` : `/rooms/${r.id}`} className="card flex h-full items-center gap-2.5 lg:p-5">
                  <RoomBadge name={r.name} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-plum">{r.name}</b>
                    <span className="hint">{r.myStatus === "pending" ? "Waiting for approval" : roleLabel(r.myRole)}</span>
                  </span>
                  {r.myStatus === "pending" ? (
                    <span className="pill pill-sun">Pending</span>
                  ) : (
                    <ChevronIcon className="text-plum" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3.5 md:flex-row">
            <Link href="/join" className="btn md:px-7">
              Join another room
            </Link>
            <Link href="/create" className="btn-secondary md:px-7">
              Create a room
            </Link>
          </div>
        </>
      )}
    </Page>
  );
}
