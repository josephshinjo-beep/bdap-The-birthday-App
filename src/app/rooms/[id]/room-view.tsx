"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { Avatar, BackLink, Countdown, DateBlock, EmptyState, ErrorNote, Loading, Page, TabPanel, Tabs, roleLabel } from "@/components/ui";
import { data } from "@/lib/data";
import { daysBetween, nextBirthday, parseISODate, relativeDays, todayIST } from "@/lib/dates";
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
        <EmptyState title="You're not in this room" action={<Link href="/join" className="btn w-full">Join with a code</Link>}>
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
      <div className="flex items-center justify-between gap-2">
        <BackLink href="/rooms">My rooms</BackLink>
        {isAdmin ? (
          <Link href={`/rooms/${room.id}/manage`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-plum">
            Manage
            {pendingCount > 0 && <span className="pill pill-pink">{pendingCount} new<span className="sr-only"> join requests</span></span>}
          </Link>
        ) : viewAsMember && room.myRole !== "member" ? (
          <Link href={`/rooms/${room.id}/manage`} className="inline-flex min-h-11 items-center text-sm font-bold text-plum">Back to dashboard</Link>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="a-h enter text-[24px]">{room.name}</h1>
        {members.data && <span className="pill">{approved.length} members</span>}
      </div>

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

      {tab === "upcoming" && (
        <TabPanel id="upcoming">
          {members.loading || celebrations.loading ? <Loading /> : <Upcoming room={room} members={approved} celebrations={celebrations.data ?? []} me={session.userId} />}
        </TabPanel>
      )}
      {tab === "members" && <TabPanel id="members">{members.loading ? <Loading /> : <MemberList members={approved} me={session.userId} />}</TabPanel>}
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

  return (
    <>
      {next ? (
        <section aria-labelledby="next-cel" className="relative flex flex-col gap-2.5 overflow-hidden rounded-[20px] bg-accent p-4 text-white">
          <span className="pill pill-glass self-start">Top secret · {next.birthdayName.split(" ")[0]} can&apos;t see this</span>
          <h2 id="next-cel" className="font-display text-2xl font-extrabold leading-[1.05] text-white">
            {next.birthdayName.split(" ")[0]}&apos;s birthday is {relativeDays(daysBetween(today, next.date))}
          </h2>
          <Countdown date={next.date} tone="pink" />
          <Link href={`/rooms/${room.id}/surprise/${next.id}`} className="btn-on-pink">
            Open the surprise →
          </Link>
        </section>
      ) : nextOther ? (
        <section className="card flex flex-col gap-1">
          <span className="label">Next birthday</span>
          <b className="font-display text-xl text-plum">{nextOther.m.fullName}</b>
          <p className="a-sub">{relativeDays(daysBetween(today, nextOther.date))}. The surprise opens a week before.</p>
        </section>
      ) : null}

      <h2 className="label">Coming up</h2>
      {list.length === 0 ? (
        <EmptyState title="No birthdays yet">Once classmates join, their birthdays show up here.</EmptyState>
      ) : (
        <ul className="card dashed-list py-0">
          {list.map(({ m, date }) => {
            const days = daysBetween(today, date);
            const isMe = m.userId === me;
            const { month, day } = parseISODate(date);
            return (
              <li key={m.userId} className="grid grid-cols-[44px_1fr_auto] items-center gap-2.5 py-2.5">
                <DateBlock month={month} day={day} />
                <div className="min-w-0 text-sm font-bold text-ink">
                  <span className="block truncate">{isMe ? "You" : m.fullName}</span>
                  <small className="block truncate text-xs font-normal text-muted">{isMe ? "Your room goes quiet for you" : `@${m.username}`}</small>
                </div>
                {isMe ? (
                  <span className="pill pill-sun">That&apos;s you</span>
                ) : days === 0 ? (
                  <span className="pill pill-pink">Today</span>
                ) : days === 1 ? (
                  <span className="pill pill-pink">Tomorrow</span>
                ) : (
                  <span className="pill">{days} days</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function MemberList({ members, me }: { members: Member[]; me: string }) {
  return (
    <ul className="card dashed-list py-0">
      {members.map((m) => (
        <li key={m.userId} className="grid grid-cols-[36px_1fr_auto] items-center gap-2.5 py-2.5">
          <Avatar name={m.fullName} url={m.avatarUrl} />
          <div className="min-w-0 text-sm font-bold text-ink">
            <span className="block truncate">{m.fullName}{m.userId === me && " (you)"}</span>
            <small className="block text-xs font-normal text-muted">@{m.username} · {m.birthDay} {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m.birthMonth - 1]}</small>
          </div>
          {m.role !== "member" ? <span className={`pill ${m.role === "moderator" ? "" : "pill-mint"}`}>{roleLabel(m.role)}</span> : <span />}
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
  const { month, day } = parseISODate(p.dob);

  async function leave() {
    try {
      await data.leaveRoom(room.id);
      router.replace("/rooms");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't leave the room.");
    }
  }

  return (
    <>
      <div className="card flex items-center gap-3">
        <Avatar name={p.fullName} url={p.avatarUrl} size={52} />
        <div className="min-w-0 flex-1">
          <b className="block font-display text-lg text-plum">{p.fullName}</b>
          <p className="hint">@{p.username} · {roleLabel(room.myRole)}</p>
        </div>
        <DateBlock month={month} day={day} />
      </div>
      <p className="hint">Classmates see your birthday as a day and month only. On your birthday, your room goes quiet for you.</p>
      <Link href="/me" className="btn-secondary">Edit profile and notifications</Link>
      {room.myRole !== "moderator" &&
        (confirm ? (
          <div className="card card-danger flex flex-col gap-2">
            <span className="label !text-danger">Leave {room.name}?</span>
            <p className="text-[13px]">You can join again later with the code.</p>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary btn-sm flex-1 !border-danger !text-danger" onClick={leave}>Leave room</button>
              <button type="button" className="btn-secondary btn-sm flex-1" onClick={() => setConfirm(false)}>Stay</button>
            </div>
          </div>
        ) : (
          <button type="button" className="min-h-11 text-sm font-bold text-danger" onClick={() => setConfirm(true)}>Leave this room</button>
        ))}
      <ErrorNote>{error}</ErrorNote>
    </>
  );
}
