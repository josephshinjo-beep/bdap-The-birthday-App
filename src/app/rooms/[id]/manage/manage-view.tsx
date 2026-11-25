"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { CodeTicket } from "@/components/code-ticket";
import { Avatar, BackLink, Columns, EmptyState, ErrorNote, Loading, Page, roleLabel } from "@/components/ui";
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
  if (room.loading)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (!room.data || room.data.myStatus !== "approved" || room.data.myRole === "member") {
    return (
      <Page>
        <EmptyState
          title="Moderators only"
          action={
            <Link href={`/rooms/${id}`} className="btn">
              Back to the room
            </Link>
          }
        >
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
    <Page size="wide">
      <div className="flex items-center justify-between gap-2">
        <BackLink href={`/rooms/${room.id}`}>Room</BackLink>
        <Link href={`/rooms/${room.id}/manage/edit`} className="inline-flex min-h-11 items-center text-sm font-bold text-plum">
          Edit room
        </Link>
      </div>
      <h1 className="a-h text-[24px] md:text-[34px]">{room.name}</h1>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <Columns
        stickySide={false}
        main={
          <>
            {room.code && <CodeTicket code={room.code} roomName={room.name} />}

            <section aria-labelledby="requests" className="card">
              <div className="flex items-center justify-between">
                <h2 id="requests" className="label">
                  Join requests
                </h2>
                {pending.length > 0 && <span className="pill pill-pink">{pending.length} new</span>}
              </div>
              {members.loading ? (
                <Loading />
              ) : pending.length === 0 ? (
                <p className="a-sub mt-2">No one waiting. Share the code to get your class in.</p>
              ) : (
                <ul className="dashed-list">
                  {pending.map((m) => (
                    <li key={m.userId} className="pop-in grid grid-cols-[36px_1fr_auto] items-center gap-2.5 py-2.5">
                      <Avatar name={m.fullName} url={m.avatarUrl} />
                      <div className="min-w-0 text-sm font-bold text-ink">
                        <span className="block truncate">{m.fullName}</span>
                        <small className="block text-xs font-normal text-muted">
                          @{m.username} · {formatDayMonth(m.birthMonth, m.birthDay)}
                        </small>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="btn-ok btn-sm"
                          disabled={busy !== null}
                          onClick={() => act(m.userId, () => data.decideRequest(room.id, m.userId, true), `${m.fullName} let in`)}
                        >
                          Let in
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          aria-label={`Decline ${m.fullName}`}
                          disabled={busy !== null}
                          onClick={() => act(m.userId, () => data.decideRequest(room.id, m.userId, false), `${m.fullName} declined`)}
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {(celebrations.data?.length ?? 0) > 0 && (
              <section aria-labelledby="cels" className="flex flex-col gap-2">
                <h2 id="cels" className="label">
                  This week&apos;s celebrations
                </h2>
                {celebrations.data!.map((c) => (
                  <Link key={c.id} href={`/rooms/${room.id}/surprise/${c.id}`} className="card flex items-center justify-between gap-2">
                    <span>
                      <b className="block text-plum">A gift for {c.birthdayName}</b>
                      <span className="hint">{formatISODayMonth(c.date)} · see the pool and who paid</span>
                    </span>
                    <span aria-hidden="true" className="text-plum">
                      →
                    </span>
                  </Link>
                ))}
              </section>
            )}
          </>
        }
        side={
          <>
            <section aria-labelledby="members" className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 id="members" className="label">
                    Members
                  </h2>
                  {members.data && <b className="text-plum">{approved.length} approved</b>}
                </div>
                {approved
                  .filter((m) => m.role === "co_moderator")
                  .slice(0, 1)
                  .map((m) => (
                    <span key={m.userId} className="pill pill-mint">
                      Co-mod: {m.fullName.split(" ")[0]}
                    </span>
                  ))}
              </div>
              <ErrorNote>{error}</ErrorNote>
              <ul className="dashed-list mt-1">
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

            <Link href={`/rooms/${room.id}?as=member`} className="btn-secondary">
              View room as a member
            </Link>
          </>
        }
      />
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
    <li className="py-2.5">
      <div className="grid grid-cols-[36px_1fr_auto] items-center gap-2.5">
        <Avatar name={m.fullName} url={m.avatarUrl} />
        <div className="min-w-0 text-sm font-bold text-ink">
          <span className="block truncate">
            {m.fullName}
            {m.userId === me && " (you)"}
          </span>
          <small className="block truncate text-xs font-normal text-muted">
            @{m.username} · {formatDayMonth(m.birthMonth, m.birthDay)} · {roleLabel(m.role)}
          </small>
        </div>
        <div className="flex gap-1">
          {canRole && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={busy}
              aria-label={m.role === "co_moderator" ? `Make ${m.fullName} a member` : `Make ${m.fullName} co-moderator`}
              onClick={() => onRole(m.role === "co_moderator" ? "member" : "co_moderator")}
            >
              {m.role === "co_moderator" ? "Make member" : "Co-mod"}
            </button>
          )}
          {canRemove && !confirm && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => setConfirm(true)} aria-label={`Remove ${m.fullName}`}>
              ✕
            </button>
          )}
        </div>
      </div>
      {confirm && (
        <div className="card card-danger mt-2 flex flex-wrap items-center gap-2">
          <span className="flex-1 text-[13px] font-bold">Remove {m.fullName} from the room?</span>
          <button type="button" className="btn-secondary btn-sm !border-danger !text-danger" disabled={busy} onClick={onRemove}>
            Remove
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setConfirm(false)}>
            Cancel
          </button>
        </div>
      )}
    </li>
  );
}
