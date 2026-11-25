"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { Avatar, BackLink, Countdown, EmptyState, ErrorNote, Loading, Page, TabPanel, Tabs, roleLabel } from "@/components/ui";
import { data } from "@/lib/data";
import { daysBetween, formatDayMonth, formatISODayMonth, nextBirthday, relativeDays, todayIST } from "@/lib/dates";
import { useAsync } from "@/lib/use-async";
import type { Celebration, Member, Room, Session } from "@/lib/types";

export function RoomView() {
  return <AuthGate>{(s) => <RoomLoader session={s} />}</AuthGate>;
}

function RoomLoader({ session }: { session: Session }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const room = useAsync(() => data.getRoom(id), [id, session.userId]);

  useEffect(() => {
    if (room.data?.myStatus === "pending") router.replace(`/rooms/${id}/waiting`);
  }, [room.data?.myStatus, id, router]);

  if (room.loading) return <Page><Loading /></Page>;
  if (!room.data || room.data.myStatus !== "approved") {
    return (
      <Page>
        <EmptyState title="You're not in this room" action={<Link href="/join" className="btn">Join with a code</Link>}>
          Ask the moderator for the room code.
        </EmptyState>
      </Page>
    );
  }
  return <RoomHome room={room.data} session={session} />;
}

type Tab = "upcoming" | "members" | "me";

function RoomHome({ room, session }: { room: Room; session: Session }) {
  const viewAsMember = useSearchParams().get("as") === "member";
  const [tab, setTab] = useState<Tab>("upcoming");
  const members = useAsync(() => data.listMembers(room.id), [room.id]);
  const celebrations = useAsync(() => data.upcomingCelebrations(room.id), [room.id]);
  const isAdmin = room.myRole !== "member" && !viewAsMember;
  const approved = useMemo(() => (members.data ?? []).filter((m) => m.status === "approved"), [members.data]);
  const pendingCount = (members.data ?? []).filter((m) => m.status === "pending").length;

  return (
    <Page>
      <BackLink href="/rooms">My rooms</BackLink>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="enter font-display text-3xl font-extrabold">{room.name}</h1>
          <p className="text-muted">{approved.length} members · {roleLabel(room.myRole)}</p>
        </div>
        {isAdmin && (
          <Link href={`/rooms/${room.id}/manage`} className="btn-ghost btn-sm relative">
            Manage room
            {pendingCount > 0 && <span className="ml-1 rounded-full bg-accent px-2 text-xs text-on-accent">{pendingCount}<span className="sr-only"> join requests</span></span>}
          </Link>
        )}
        {viewAsMember && room.myRole !== "member" && (
          <Link href={`/rooms/${room.id}/manage`} className="btn-ghost btn-sm">Back to moderator view</Link>
        )}
      </div>

      <div className="mt-5">
        <Tabs<Tab>
          label="Room sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "upcoming", label: "Upcoming" },
            { id: "members", label: "Members" },
            { id: "me", label: "Me" },
          ]}
        />
      </div>

      {tab === "upcoming" && (
        <TabPanel id="upcoming">
          {members.loading || celebrations.loading ? (
            <Loading />
          ) : (
            <Upcoming room={room} members={approved} celebrations={celebrations.data ?? []} me={session.userId} />
          )}
        </TabPanel>
      )}
      {tab === "members" && (
        <TabPanel id="members">
          {members.loading ? <Loading /> : <MemberList members={approved} me={session.userId} />}
        </TabPanel>
      )}
      {tab === "me" && (
        <TabPanel id="me">
          <MeTab room={room} session={session} />
        </TabPanel>
      )}
    </Page>
  );
}

function Upcoming({ room, members, celebrations, me }: { room: Room; members: Member[]; celebrations: Celebration[]; me: string }) {
  const today = todayIST();
  const next = celebrations[0];
  const list = members
    .map((m) => ({ m, date: nextBirthday(m.birthMonth, m.birthDay, today) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 12);
  const nextOther = list.find((x) => x.m.userId !== me);
  const meSoon = list.find((x) => x.m.userId === me && daysBetween(today, x.date) <= 7);

  return (
    <div className="space-y-5">
      {next ? (
        <section aria-labelledby="next-cel" className="relative overflow-hidden rounded-3xl border-2 border-ink bg-accent p-5 text-[#221b3a] shadow-pop sm:p-6">
          <span aria-hidden="true" className="float absolute -right-3 -top-3 text-7xl">🎁</span>
          <p className="text-sm font-bold uppercase tracking-widest">Next secret celebration</p>
          <h2 id="next-cel" className="mt-1 font-display text-3xl font-extrabold">{next.birthdayName}</h2>
          <p className="font-medium">{formatISODayMonth(next.date)} · {relativeDays(daysBetween(today, next.date))}</p>
          <div className="mt-4">
            <Countdown date={next.date} />
          </div>
          <Link href={`/rooms/${room.id}/surprise/${next.id}`} className="btn mt-5 w-full bg-surface sm:w-auto">
            Open the surprise →
          </Link>
        </section>
      ) : nextOther ? (
        <section className="card p-5">
          <p className="text-sm font-bold uppercase tracking-widest text-muted">Next birthday</p>
          <p className="mt-1 font-display text-2xl font-extrabold">{nextOther.m.fullName}</p>
          <p className="text-muted">{formatISODayMonth(nextOther.date)} · {relativeDays(daysBetween(today, nextOther.date))}. The surprise opens a week before.</p>
        </section>
      ) : null}

      {meSoon && (
        <p className="card bg-surface-2 p-4 font-medium">🤫 Your birthday is {relativeDays(daysBetween(today, meSoon.date))}. Your room goes quiet for you, so no peeking.</p>
      )}

      <section aria-labelledby="upcoming-list">
        <h2 id="upcoming-list" className="mb-2 font-display text-xl font-bold">Upcoming birthdays</h2>
        {list.length === 0 ? (
          <EmptyState title="No birthdays yet">Once classmates join, their birthdays show up here.</EmptyState>
        ) : (
          <ul className="card divide-y divide-line p-0">
            {list.map(({ m, date }) => {
              const days = daysBetween(today, date);
              const isMe = m.userId === me;
              return (
                <li key={m.userId} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={m.fullName} url={m.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{m.fullName}{isMe && " (you)"}</p>
                    <p className="text-sm text-muted">{isMe ? "That's you — your room goes quiet for you" : `${formatDayMonth(m.birthMonth, m.birthDay)} · ${relativeDays(days)}`}</p>
                  </div>
                  {!isMe && days <= 7 && <span className="chip bg-sun text-[#221b3a]">{days === 0 ? "Today!" : "Soon"}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function MemberList({ members, me }: { members: Member[]; me: string }) {
  return (
    <ul className="card divide-y divide-line p-0">
      {members.map((m) => (
        <li key={m.userId} className="flex items-center gap-3 px-4 py-3">
          <Avatar name={m.fullName} url={m.avatarUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{m.fullName}{m.userId === me && " (you)"}</p>
            <p className="text-sm text-muted">@{m.username} · 🎂 {formatDayMonth(m.birthMonth, m.birthDay)}</p>
          </div>
          {m.role !== "member" && <span className="chip">{roleLabel(m.role)}</span>}
        </li>
      ))}
    </ul>
  );
}

function MeTab({ room, session }: { room: Room; session: Session }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const p = session.profile!;
  const [, month, day] = p.dob.split("-").map(Number);

  async function leave() {
    try {
      await data.leaveRoom(room.id);
      router.replace("/rooms");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't leave the room.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex items-center gap-4 p-5">
        <Avatar name={p.fullName} url={p.avatarUrl} size={56} />
        <div>
          <p className="font-display text-xl font-bold">{p.fullName}</p>
          <p className="text-muted">@{p.username} · {roleLabel(room.myRole)}</p>
          <p className="text-muted">Classmates see your birthday as 🎂 {formatDayMonth(month!, day!)}</p>
        </div>
      </div>
      <Link href="/me" className="btn-ghost w-full">Edit profile and notifications</Link>
      {room.myRole !== "moderator" &&
        (confirm ? (
          <div className="card p-4">
            <p className="font-bold">Leave {room.name}?</p>
            <p className="hint">You can join again later with the code.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn bg-danger" onClick={leave}>Leave room</button>
              <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>Stay</button>
            </div>
          </div>
        ) : (
          <button type="button" className="min-h-11 w-full font-bold text-danger" onClick={() => setConfirm(true)}>Leave this room</button>
        ))}
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}
