"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { CodeTicket } from "@/components/code-ticket";
import { Avatar, BackLink, Columns, DateBlock, EmptyState, ErrorNote, Loading, Page, TabPanel, Tabs, roleLabel } from "@/components/ui";
import { data } from "@/lib/data";
import { daysBetween, formatDayMonth, formatTime, parseISODate, relativeDays, todayIST } from "@/lib/dates";
import { onMockChange } from "@/lib/data/mock";
import { dataMode } from "@/lib/data";
import { useAsync } from "@/lib/use-async";
import type { Celebration, CelebrationDecision, Member, Room, Session } from "@/lib/types";

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

type AdminTab = "overview" | "birthdays" | "members" | "settings";
const TABS: AdminTab[] = ["overview", "birthdays", "members", "settings"];

function Manage({ room, session }: { room: Room; session: Session }) {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("tab") as AdminTab | null;
  const [tab, setTabState] = useState<AdminTab>(initial && TABS.includes(initial) ? initial : "overview");
  const members = useAsync(() => data.listMembers(room.id), [room.id]);
  const birthdays = useAsync(() => data.adminCelebrations(room.id), [room.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const isModerator = room.myRole === "moderator";
  const reloadMembers = members.reload;
  const reloadBirthdays = birthdays.reload;

  function setTab(t: AdminTab) {
    setTabState(t);
    router.replace(`/rooms/${room.id}/manage${t === "overview" ? "" : `?tab=${t}`}`, { scroll: false });
  }

  // New join requests and decisions show up without a refresh.
  useEffect(() => {
    const offNotes = data.onNotification((n) => {
      if (n.roomId !== room.id) return;
      if (n.kind === "join_request") reloadMembers();
      if (n.kind === "decision_needed") reloadBirthdays();
    });
    const offMock =
      dataMode === "mock"
        ? onMockChange(() => {
            reloadMembers();
            reloadBirthdays();
          })
        : () => {};
    return () => {
      offNotes();
      offMock();
    };
  }, [room.id, reloadMembers, reloadBirthdays]);

  async function act(key: string, fn: () => Promise<void>, done: string, after: () => void = reloadMembers) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      setAnnounce(done);
      after();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  const pending = (members.data ?? []).filter((m) => m.status === "pending");
  const approved = (members.data ?? []).filter((m) => m.status === "approved");
  const cels = birthdays.data ?? [];
  const undecided = cels.filter((c) => c.decision === "pending");

  return (
    <Page size="wide">
      <div className="flex items-center justify-between gap-2">
        <BackLink href={`/rooms/${room.id}`}>Room</BackLink>
        <Link href={`/rooms/${room.id}?as=member`} className="inline-flex min-h-11 items-center text-sm font-bold text-plum">
          View as member
        </Link>
      </div>
      <div>
        <span className="pill pill-sun">Admin dashboard · {roleLabel(room.myRole)}</span>
        <h1 className="a-h mt-2 text-[24px] md:text-[34px]">{room.name}</h1>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <ErrorNote>{error}</ErrorNote>

      <div className="lg:max-w-2xl">
        <Tabs<AdminTab>
          label="Dashboard sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "birthdays", label: undecided.length ? `Birthdays (${undecided.length})` : "Birthdays" },
            { id: "members", label: pending.length ? `Members (${pending.length})` : "Members" },
            { id: "settings", label: "Settings" },
          ]}
        />
      </div>

      {tab === "overview" && (
        <TabPanel id="overview">
          <Columns
            stickySide={false}
            main={
              <>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:gap-4">
                  <Stat label="Members" value={members.data ? approved.length : "–"} />
                  <Stat label="Join requests" value={members.data ? pending.length : "–"} tone={pending.length ? "pink" : undefined} onClick={() => setTab("members")} />
                  <Stat label="Need a decision" value={birthdays.data ? undecided.length : "–"} tone={undecided.length ? "pink" : undefined} onClick={() => setTab("birthdays")} />
                  <Stat label="Celebrating" value={birthdays.data ? cels.filter((c) => c.decision === "celebrate").length : "–"} tone="mint" onClick={() => setTab("birthdays")} />
                </div>
                {undecided.length > 0 && (
                  <button type="button" onClick={() => setTab("birthdays")} className="card card-danger flex w-full items-center justify-between gap-3 text-left">
                    <span>
                      <b className="block text-plum">
                        {undecided.length === 1 ? `${undecided[0]!.birthdayName.split(" ")[0]}'s birthday needs a decision` : `${undecided.length} birthdays need a decision`}
                      </b>
                      <span className="hint">Nothing goes to the class until you choose Celebrate. Otherwise only a birthday wish goes out.</span>
                    </span>
                    <span aria-hidden="true" className="text-plum">
                      →
                    </span>
                  </button>
                )}
                <JoinRequests room={room} pending={pending} loading={members.loading} busy={busy} act={act} />
              </>
            }
            side={
              <>
                {room.code && <CodeTicket code={room.code} roomName={room.name} />}
                <section className="card flex flex-col gap-1.5">
                  <h2 className="label">Reminders</h2>
                  <ReminderSummary room={room} />
                  <Link href={`/rooms/${room.id}/manage/edit`} className="btn-secondary btn-sm mt-1 self-start">
                    Change times
                  </Link>
                </section>
              </>
            }
          />
        </TabPanel>
      )}

      {tab === "birthdays" && (
        <TabPanel id="birthdays">
          <BirthdaysTab room={room} cels={cels} loading={birthdays.loading} busy={busy} act={act} reload={reloadBirthdays} />
        </TabPanel>
      )}

      {tab === "members" && (
        <TabPanel id="members">
          <Columns
            stickySide={false}
            main={
              <section aria-labelledby="members-h" className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 id="members-h" className="label">
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
            }
            side={<JoinRequests room={room} pending={pending} loading={members.loading} busy={busy} act={act} />}
          />
        </TabPanel>
      )}

      {tab === "settings" && (
        <TabPanel id="settings">
          <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            <SettingsLink href={`/rooms/${room.id}/manage/edit`} title="Room settings" body="Name, amount, payers per UPI ID, reminder times, approval and birthday wish." />
            <SettingsLink href={`/rooms/${room.id}/manage/edit#upis`} title="UPI IDs" body="Add, edit, pause or delete the UPI IDs that collect money." />
            <SettingsLink href={`/rooms/${room.id}/manage/edit#code`} title="Room code" body="Copy, share or make a new code if it leaked." />
            {isModerator && (
              <SettingsLink href={`/rooms/${room.id}/manage/edit#comods`} title="Co-moderators" body="Choose who helps run the room, and who decides on your birthday." />
            )}
            {isModerator && <SettingsLink href={`/rooms/${room.id}/manage/edit#danger`} title="Delete room" body="Remove the room and everything in it for good." danger />}
          </div>
          <section className="card flex flex-col gap-1.5 lg:max-w-xl">
            <h2 className="label">Current reminders</h2>
            <ReminderSummary room={room} />
          </section>
        </TabPanel>
      )}
    </Page>
  );
}

function Stat({ label, value, tone, onClick }: { label: string; value: number | string; tone?: "pink" | "mint"; onClick?: () => void }) {
  const ring = tone === "pink" ? "border-accent" : tone === "mint" ? "border-mint" : "border-line";
  const body = (
    <>
      <span className="label">{label}</span>
      <b className={`block font-display text-3xl ${tone === "pink" ? "text-accent" : "text-plum"}`}>{value}</b>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={`card w-full text-left ${ring}`}>
      {body}
    </button>
  ) : (
    <div className={`card ${ring}`}>{body}</div>
  );
}

function SettingsLink({ href, title, body, danger = false }: { href: string; title: string; body: string; danger?: boolean }) {
  return (
    <Link href={href} className={`card flex items-start justify-between gap-3 ${danger ? "card-danger" : ""}`}>
      <span>
        <b className={`block ${danger ? "text-danger" : "text-plum"}`}>{title}</b>
        <span className="hint">{body}</span>
      </span>
      <span aria-hidden="true" className="text-plum">
        →
      </span>
    </Link>
  );
}

function ReminderSummary({ room }: { room: Room }) {
  const rows: [string, boolean, string][] = [
    ["A week before", room.remindWeekBefore, room.remindWeekBeforeAt],
    ["The day before", room.remindDayBefore, room.remindDayBeforeAt],
    ["On the day", room.remindOnDay, room.remindOnDayAt],
  ];
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {rows.map(([label, on, time]) => (
        <li key={label} className="flex justify-between gap-2">
          <span>{label}</span>
          <span className={on ? "font-bold text-plum" : "text-muted"}>{on ? formatTime(time) : "Off"}</span>
        </li>
      ))}
      <li className="flex justify-between gap-2">
        <span>Approval</span>
        <span className="font-bold text-plum">{room.autoCelebrate ? "Automatic" : "Admin approves each"}</span>
      </li>
      <li className="flex justify-between gap-2">
        <span>Birthday wish</span>
        <span className={room.sendBirthdayWish ? "font-bold text-plum" : "text-muted"}>{room.sendBirthdayWish ? "On" : "Off"}</span>
      </li>
    </ul>
  );
}

type Act = (key: string, fn: () => Promise<void>, done: string, after?: () => void) => Promise<void>;

function JoinRequests({ room, pending, loading, busy, act }: { room: Room; pending: Member[]; loading: boolean; busy: string | null; act: Act }) {
  return (
    <section aria-labelledby="requests" className="card">
      <div className="flex items-center justify-between">
        <h2 id="requests" className="label">
          Join requests
        </h2>
        {pending.length > 0 && <span className="pill pill-pink">{pending.length} new</span>}
      </div>
      {loading ? (
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
  );
}

const DECISION_PILL: Record<CelebrationDecision, { label: string; cls: string }> = {
  pending: { label: "Needs a decision", cls: "pill-pink" },
  celebrate: { label: "Celebrating", cls: "pill-mint" },
  wish_only: { label: "Wish only", cls: "pill-sun" },
};

function decisionNote(c: Celebration, room: Room): string {
  const first = c.birthdayName.split(" ")[0];
  if (c.decision === "celebrate") {
    return `The class gets secret reminders and can chip in.${room.sendBirthdayWish ? ` ${first} gets a birthday wish on the day.` : ""}`;
  }
  if (c.decision === "wish_only") {
    return `No reminders or collection. On the day the class is nudged to wish ${first}${room.sendBirthdayWish ? `, and ${first} gets a wish from the room` : ""}.`;
  }
  return "Nothing goes to the class yet. If no one decides, it becomes a wish only on the day.";
}

function BirthdaysTab({ room, cels, loading, busy, act, reload }: { room: Room; cels: Celebration[]; loading: boolean; busy: string | null; act: Act; reload: () => void }) {
  const today = todayIST();
  if (loading) return <Loading />;
  return (
    <Columns
      stickySide={false}
      main={
        cels.length === 0 ? (
          <EmptyState title="No birthdays in the next 30 days">They show up here a month ahead so you can decide early.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {cels.map((c) => {
              const { month, day } = parseISODate(c.date);
              const first = c.birthdayName.split(" ")[0];
              const pill = DECISION_PILL[c.decision];
              const decide = (d: CelebrationDecision, msg: string) => act(c.id, () => data.setCelebrationDecision(c.id, d), msg, reload);
              return (
                <li key={c.id} className={`card flex flex-col gap-3 ${c.decision === "pending" ? "border-accent" : ""}`}>
                  <div className="grid grid-cols-[44px_1fr_auto] items-center gap-2.5">
                    <DateBlock month={month} day={day} />
                    <div className="min-w-0">
                      <b className="block truncate text-plum">{c.birthdayName}</b>
                      <span className="hint">{relativeDays(daysBetween(today, c.date))}</span>
                    </div>
                    <span className={`pill ${pill.cls}`}>{pill.label}</span>
                  </div>
                  <p className="text-[13px] text-muted">{decisionNote(c, room)}</p>
                  <div className="flex flex-wrap gap-2">
                    {c.decision !== "celebrate" && (
                      <button type="button" className="btn btn-sm" disabled={busy !== null} onClick={() => decide("celebrate", `Celebrating ${first}'s birthday`)}>
                        Celebrate 🎉
                      </button>
                    )}
                    {c.decision !== "wish_only" && (
                      <button type="button" className="btn-secondary btn-sm" disabled={busy !== null} onClick={() => decide("wish_only", `${first}: wish only`)}>
                        Just wish
                      </button>
                    )}
                    {c.decision !== "pending" && (
                      <button type="button" className="btn-secondary btn-sm" disabled={busy !== null} onClick={() => decide("pending", `${first}: decision cleared`)}>
                        Undo decision
                      </button>
                    )}
                    {c.decision === "celebrate" && (
                      <Link href={`/rooms/${room.id}/surprise/${c.id}`} className="btn-secondary btn-sm">
                        Pool and who paid →
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      }
      side={
        <section className="card flex flex-col gap-2 text-[13px]">
          <h2 className="label">How approval works</h2>
          <p>
            <b className="text-plum">Celebrate 🎉</b> sends the secret reminders at your times and opens the surprise page and UPI collection.
          </p>
          <p>
            <b className="text-plum">Just wish</b> sends no reminders and collects nothing. On the day the class is nudged to wish them.
          </p>
          <p>
            <b className="text-plum">Not decided</b> works like Just wish on the day. You can change your mind any time before.
          </p>
          <p className="hint">The birthday person never sees this page or the decision. On your own birthday, your co-moderators decide.</p>
          <Link href={`/rooms/${room.id}/manage/edit`} className="btn-secondary btn-sm mt-1 self-start">
            Reminder times and auto-approve
          </Link>
        </section>
      }
    />
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
