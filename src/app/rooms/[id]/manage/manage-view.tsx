"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { CodeTicket } from "@/components/code-ticket";
import { Avatar, BackLink, EmptyState, ErrorNote, Loading, Page, roleLabel } from "@/components/ui";
import { data } from "@/lib/data";
import { formatDayMonth, formatISODayMonth } from "@/lib/dates";
import { onMockChange } from "@/lib/data/mock";
import { dataMode } from "@/lib/data";
import { useAsync } from "@/lib/use-async";
import type { Member, Room, Session } from "@/lib/types";

export function ManageView() {
  return <AuthGate>{(s) => <ManageLoader session={s} />}</AuthGate>;
}

function ManageLoader({ session }: { session: Session }) {
  const { id } = useParams<{ id: string }>();
  const room = useAsync(() => data.getRoom(id), [id, session.userId]);
  if (room.loading) return <Page><Loading /></Page>;
  if (!room.data || room.data.myStatus !== "approved" || room.data.myRole === "member") {
    return (
      <Page>
        <EmptyState title="Moderators only" action={<Link href={`/rooms/${id}`} className="btn">Back to the room</Link>}>
          This dashboard is for the room&apos;s moderator and co-moderators.
        </EmptyState>
      </Page>
    );
  }
  return <Manage room={room.data} session={session} />;
}

function Manage({ room, session }: { room: Room; session: Session }) {
  const members = useAsync(() => data.listMembers(room.id), [room.id]);
  const celebrations = useAsync(() => data.upcomingCelebrations(room.id), [room.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const isModerator = room.myRole === "moderator";
  const reloadMembers = members.reload;

  // New join requests show up without a refresh.
  useEffect(() => {
    const offNotes = data.onNotification((n) => n.kind === "join_request" && n.roomId === room.id && reloadMembers());
    const offMock = dataMode === "mock" ? onMockChange(reloadMembers) : () => {};
    return () => {
      offNotes();
      offMock();
    };
  }, [room.id, reloadMembers]);

  async function act(key: string, fn: () => Promise<void>, done: string) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      setAnnounce(done);
      members.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  const pending = (members.data ?? []).filter((m) => m.status === "pending");
  const approved = (members.data ?? []).filter((m) => m.status === "approved");

  return (
    <Page>
      <BackLink href={`/rooms/${room.id}`}>{room.name}</BackLink>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-3xl font-extrabold">Moderator dashboard</h1>
        <div className="flex gap-2">
          <Link href={`/rooms/${room.id}?as=member`} className="btn-ghost btn-sm">View as member</Link>
          <Link href={`/rooms/${room.id}/manage/edit`} className="btn-ghost btn-sm">Edit room</Link>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{announce}</p>

      <div className="mt-5">{room.code && <CodeTicket code={room.code} roomName={room.name} />}</div>

      <section aria-labelledby="requests" className="mt-8">
        <h2 id="requests" className="font-display text-xl font-bold">
          Join requests {pending.length > 0 && <span className="chip ml-1 bg-accent text-on-accent">{pending.length}</span>}
        </h2>
        {members.loading ? (
          <Loading />
        ) : pending.length === 0 ? (
          <p className="mt-2 text-muted">No one waiting. Share the code to get your class in.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pending.map((m) => (
              <li key={m.userId} className="card pop-in flex flex-wrap items-center gap-3 p-4">
                <Avatar name={m.fullName} url={m.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{m.fullName}</p>
                  <p className="text-sm text-muted">@{m.username} · 🎂 {formatDayMonth(m.birthMonth, m.birthDay)}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-sm bg-mint" disabled={busy !== null} onClick={() => act(m.userId, () => data.decideRequest(room.id, m.userId, true), `${m.fullName} let in`)}>
                    Let in
                  </button>
                  <button type="button" className="btn-ghost btn-sm" disabled={busy !== null} onClick={() => act(m.userId, () => data.decideRequest(room.id, m.userId, false), `${m.fullName} declined`)}>
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(celebrations.data?.length ?? 0) > 0 && (
        <section aria-labelledby="cels" className="mt-8">
          <h2 id="cels" className="font-display text-xl font-bold">This week&apos;s celebrations</h2>
          <ul className="mt-3 space-y-2">
            {celebrations.data!.map((c) => (
              <li key={c.id}>
                <Link href={`/rooms/${room.id}/surprise/${c.id}`} className="card flex items-center justify-between p-4">
                  <span>
                    <span className="block font-bold">🎁 {c.birthdayName}</span>
                    <span className="text-sm text-muted">{formatISODayMonth(c.date)} · see the pool and who paid</span>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="members" className="mt-8">
        <h2 id="members" className="font-display text-xl font-bold">Members ({approved.length})</h2>
        <ErrorNote>{error}</ErrorNote>
        <ul className="card mt-3 divide-y divide-line p-0">
          {approved.map((m) => (
            <MemberRow
              key={m.userId}
              m={m}
              me={session.userId}
              isModerator={isModerator}
              busy={busy === m.userId}
              onRole={(role) => act(m.userId, () => data.setMemberRole(room.id, m.userId, role), `${m.fullName} is now ${roleLabel(role)}`)}
              onRemove={() => act(m.userId, () => data.removeMember(room.id, m.userId), `${m.fullName} removed`)}
            />
          ))}
        </ul>
      </section>
    </Page>
  );
}

function MemberRow({
  m,
  me,
  isModerator,
  busy,
  onRole,
  onRemove,
}: {
  m: Member;
  me: string;
  isModerator: boolean;
  busy: boolean;
  onRole: (r: "co_moderator" | "member") => void;
  onRemove: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const canRemove = m.userId !== me && m.role !== "moderator" && (m.role === "member" || isModerator);
  const canRole = isModerator && m.userId !== me && m.role !== "moderator";

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={m.fullName} url={m.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{m.fullName}{m.userId === me && " (you)"}</p>
          <p className="text-sm text-muted">@{m.username} · 🎂 {formatDayMonth(m.birthMonth, m.birthDay)} · {roleLabel(m.role)}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {canRole && (
            <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => onRole(m.role === "co_moderator" ? "member" : "co_moderator")}>
              {m.role === "co_moderator" ? "Make member" : "Make co-moderator"}
            </button>
          )}
          {canRemove && !confirm && (
            <button type="button" className="min-h-10 px-3 text-sm font-bold text-danger" onClick={() => setConfirm(true)} aria-label={`Remove ${m.fullName}`}>
              Remove
            </button>
          )}
        </div>
      </div>
      {confirm && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-3">
          <span className="flex-1 text-sm font-medium">Remove {m.fullName} from the room?</span>
          <button type="button" className="btn btn-sm bg-danger" disabled={busy} onClick={onRemove}>Remove</button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      )}
    </li>
  );
}
