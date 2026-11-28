"use client";
// In-memory sample data for building pages without a backend.
// State lives in localStorage so it survives reloads and syncs across tabs
// (open two tabs as different demo users to see "realtime" approvals).
// Switch users with the demo switcher (bottom of every page in mock mode).

import { addDays, birthdayInYear, daysBetween, formatISODayMonth, nextBirthday, parseISODate, timeIST, todayIST } from "@/lib/dates";
import { checkContribution, isPriority, pickWinner, splitAmount } from "@/lib/split";
import { DECISION_WINDOW_DAYS, dueReminders, reminderText } from "@/lib/reminders";
import { pickUpiAccount } from "@/lib/upi";
import {
  DataError,
  isAdminRole,
  type AppNotification,
  type Celebration,
  type CelebrationDecision,
  type Expense,
  type ExpenseStatus,
  type Poll,
  type WishColor,
  type CreateRoomInput,
  type Member,
  type MemberStatus,
  type Payer,
  type Pool,
  type Profile,
  type ProfileInput,
  type Role,
  type Room,
  type RoomPreview,
  type RoomSettingsInput,
  type Session,
  type Surprise,
  type UpiAccount,
} from "@/lib/types";
import type { DataApi, Unsubscribe } from "./api";

const STORE_KEY = "bdap-mock-v3";
const USER_KEY = "bdap-mock-user";
const EVENT = "bdap-mock-change";
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// ---------------------------------------------------------------------------
// Demo users
// ---------------------------------------------------------------------------
export const DEMO_USERS = [
  { id: "u-kabir", label: "Member", hint: "Kabir · sees the surprise" },
  { id: "u-aarav", label: "Moderator", hint: "Aarav · runs CSE B" },
  { id: "u-riya", label: "Birthday person", hint: "Riya · birthday today (sees her wall)" },
  { id: "u-f0", label: "Class rep", hint: "Ananya · requests splits, records payments" },
  { id: "u-new", label: "New student", hint: "No profile yet" },
] as const;
export type DemoUserId = (typeof DEMO_USERS)[number]["id"];

interface StoredRoom {
  id: string;
  name: string;
  code: string;
  amountMode: Room["amountMode"];
  amount: number | null;
  payersPerUpi: number;
  remindWeekBefore: boolean;
  remindDayBefore: boolean;
  remindOnDay: boolean;
  remindWeekBeforeAt: string;
  remindDayBeforeAt: string;
  remindOnDayAt: string;
  sendBirthdayWish: boolean;
  autoCelebrate: boolean;
  createdBy: string;
}
interface StoredMembership {
  roomId: string;
  userId: string;
  role: Role;
  status: MemberStatus;
  requestedAt: string;
}
interface StoredUpi extends UpiAccount {
  roomId: string;
}
interface StoredContribution {
  celebrationId: string;
  userId: string;
  upiAccountId: string | null;
  amount: number | null;
  paidAt: string | null;
  recordedBy?: string | null;
}
interface StoredPoll {
  id: string;
  roomId: string;
  celebrationId: string | null;
  question: string;
  status: "open" | "closed";
  winnerOptionId: string | null;
  options: { id: string; label: string; price: number | null; sortOrder: number }[];
}
interface StoredExpense {
  id: string;
  roomId: string;
  title: string;
  purpose: string | null;
  totalAmount: number;
  splitAmount: number | null;
  upiAccountId: string | null;
  dueDate: string | null;
  status: ExpenseStatus;
  createdBy: string | null;
  createdAt: string;
}
interface StoredWish {
  id: string;
  celebrationId: string;
  authorId: string;
  message: string;
  isPrivate: boolean;
  color: WishColor;
  x: number;
  y: number;
  rotation: number;
  createdAt: string;
}
interface StoredNotification extends AppNotification {
  userId: string;
}
interface Store {
  seededFor: string;
  profiles: Profile[];
  emails: Record<string, string>;
  rooms: StoredRoom[];
  memberships: StoredMembership[];
  upi: StoredUpi[];
  contributions: StoredContribution[];
  notifications: StoredNotification[];
  /** Admin decisions per celebration id. Missing = the room's default. */
  decisions: Record<string, CelebrationDecision>;
  celDetails: Record<string, { purpose: string | null; totalExpense: number | null; plan: string | null }>;
  polls: StoredPoll[];
  pollVotes: { pollId: string; userId: string; optionId: string }[];
  expenses: StoredExpense[];
  expensePayments: { expenseId: string; userId: string; amount: number | null; paidAt: string | null; recordedBy: string | null }[];
  wishes: StoredWish[];
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
const FILLER = [
  "Ananya Iyer", "Rohan Das", "Sneha Pillai", "Vikram Rao", "Diya Menon", "Arjun Reddy",
  "Tara Joseph", "Nikhil Bose", "Pooja Shetty", "Siddharth Jain", "Neha Gupta", "Aditya Kulkarni",
  "Ishaan Malhotra", "Kavya Krishnan", "Rahul Verma", "Simran Kaur", "Varun Nambiar", "Zara Sheikh",
];

function dobFromDate(iso: string, year = 2005): string {
  const { month, day } = parseISODate(iso);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function username(name: string): string {
  return name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");
}

function seed(): Store {
  const today = todayIST();
  const now = new Date().toISOString();
  const profiles: Profile[] = [
    { id: "u-aarav", fullName: "Aarav Sharma", username: "aarav.s", dob: "2005-03-14", avatarUrl: null },
    { id: "u-kabir", fullName: "Kabir Mehta", username: "kabir.m", dob: "2005-07-02", avatarUrl: null },
    { id: "u-riya", fullName: "Riya Kapoor", username: "riya.k", dob: dobFromDate(today), avatarUrl: null },
    { id: "u-meera", fullName: "Meera Nair", username: "meera.n", dob: dobFromDate(addDays(today, 5), 2004), avatarUrl: null },
    { id: "u-isha", fullName: "Isha Verma", username: "isha.v", dob: "2005-09-21", avatarUrl: null },
  ];
  FILLER.forEach((name, i) => {
    const offset = 12 + i * 19;
    profiles.push({ id: `u-f${i}`, fullName: name, username: username(name), dob: dobFromDate(addDays(today, offset), 2005 - (i % 2)), avatarUrl: null });
  });

  const rooms: StoredRoom[] = [
    {
      id: "r-cseb", name: "CSE B · 3rd year", code: "CSEB26", amountMode: "suggested", amount: 50,
      payersPerUpi: 20, remindWeekBefore: false, remindDayBefore: true, remindOnDay: true,
      remindWeekBeforeAt: "18:00", remindDayBeforeAt: "18:00", remindOnDayAt: "07:30", sendBirthdayWish: true, autoCelebrate: false,
      createdBy: "u-aarav",
    },
    {
      id: "r-hostel", name: "Hostel Block C", code: "HSTLC7", amountMode: "fixed", amount: 30,
      payersPerUpi: 20, remindWeekBefore: true, remindDayBefore: true, remindOnDay: true,
      remindWeekBeforeAt: "19:00", remindDayBeforeAt: "21:00", remindOnDayAt: "08:00", sendBirthdayWish: true, autoCelebrate: true,
      createdBy: "u-meera",
    },
  ];

  const memberships: StoredMembership[] = [
    { roomId: "r-cseb", userId: "u-aarav", role: "moderator", status: "approved", requestedAt: now },
    { roomId: "r-cseb", userId: "u-meera", role: "co_moderator", status: "approved", requestedAt: now },
    { roomId: "r-cseb", userId: "u-kabir", role: "member", status: "approved", requestedAt: now },
    { roomId: "r-cseb", userId: "u-riya", role: "member", status: "approved", requestedAt: now },
    { roomId: "r-cseb", userId: "u-isha", role: "member", status: "pending", requestedAt: now },
    // Ananya (u-f0) is the class rep.
    ...FILLER.map((_, i) => ({ roomId: "r-cseb", userId: `u-f${i}`, role: (i === 0 ? "class_rep" : "member") as Role, status: "approved" as MemberStatus, requestedAt: now })),
    { roomId: "r-hostel", userId: "u-meera", role: "moderator", status: "approved", requestedAt: now },
    { roomId: "r-hostel", userId: "u-riya", role: "member", status: "approved", requestedAt: now },
    { roomId: "r-hostel", userId: "u-f2", role: "member", status: "approved", requestedAt: now },
  ];

  const upi: StoredUpi[] = [
    { id: "upi-1", roomId: "r-cseb", upiId: "aarav.sharma@okaxis", payeeName: "Aarav Sharma", ownerUserId: "u-aarav", qrImageUrl: null, sortOrder: 0, active: true },
    { id: "upi-2", roomId: "r-cseb", upiId: "meera.nair@ybl", payeeName: "Meera Nair", ownerUserId: "u-meera", qrImageUrl: null, sortOrder: 1, active: true },
    { id: "upi-3", roomId: "r-hostel", upiId: "meera.nair@ybl", payeeName: "Meera Nair", ownerUserId: "u-meera", qrImageUrl: null, sortOrder: 0, active: true },
  ];

  // Riya's birthday is today: 12 payers on the first UPI ID, 9 of them paid.
  const riyaCel = celebrationId("r-cseb", "u-riya", today);
  const contributions: StoredContribution[] = FILLER.slice(0, 12).map((_, i) => ({
    celebrationId: riyaCel,
    userId: `u-f${i}`,
    upiAccountId: "upi-1",
    amount: i % 4 === 0 ? 100 : 50,
    paidAt: i < 9 ? now : null,
  }));

  return {
    seededFor: today,
    profiles,
    emails: { "u-new": "new.student@example.com" },
    rooms,
    memberships,
    upi,
    contributions,
    notifications: [],
    // CSE B: Riya's birthday is approved; Meera's waits for an admin decision.
    decisions: { [riyaCel]: "celebrate" },
    celDetails: {
      [riyaCel]: { purpose: "Cake 🎂 and a gift", totalExpense: 1050, plan: "Cake cutting at 4:30 PM in the CSE lab. Wear something pink!" },
    },
    polls: [
      {
        id: "poll-riya", roomId: "r-cseb", celebrationId: riyaCel, question: "Which cake for Riya?", status: "open", winnerOptionId: null,
        options: [
          { id: "opt-choc", label: "Chocolate truffle", price: 1050, sortOrder: 0 },
          { id: "opt-rv", label: "Red velvet", price: 1200, sortOrder: 1 },
          { id: "opt-bf", label: "Black forest", price: 900, sortOrder: 2 },
        ],
      },
    ],
    pollVotes: FILLER.slice(0, 11).map((_, i) => ({ pollId: "poll-riya", userId: `u-f${i}`, optionId: i % 3 === 0 ? "opt-rv" : i % 3 === 1 ? "opt-choc" : "opt-bf" })),
    expenses: [
      {
        id: "exp-bus", roomId: "r-cseb", title: "Industrial visit bus", purpose: "Bus to the Technopark visit on Friday", totalAmount: 6600,
        splitAmount: 300, upiAccountId: "upi-1", dueDate: addDays(today, 6), status: "approved", createdBy: "u-f0", createdAt: now,
      },
      {
        id: "exp-print", roomId: "r-cseb", title: "Lab record printouts", purpose: "Printing and binding for 22 records", totalAmount: 1100,
        splitAmount: null, upiAccountId: "upi-2", dueDate: addDays(today, 10), status: "requested", createdBy: "u-f0", createdAt: now,
      },
    ],
    expensePayments: FILLER.slice(0, 8).map((_, i) => ({ expenseId: "exp-bus", userId: `u-f${i}`, amount: 300, paidAt: now, recordedBy: i % 3 === 0 ? "u-f0" : null })),
    wishes: [
      ["u-f1", "Happy birthday Riya! 🎉 Thanks for always sharing your notes before exams.", false, "sun", 6, 8, -4],
      ["u-f2", "To the best lab partner ever. Have the best day!", false, "pink", 38, 12, 3],
      ["u-kabir", "HBD! The cake is on its way, act surprised 🤫", false, "mint", 68, 6, -2],
      ["u-f4", "Wishing you a year full of good grades and great food.", false, "sky", 12, 46, 5],
      ["u-f5", "I never said it, but your project ideas inspire me. Happy birthday.", true, "white", 44, 48, -5],
      ["u-aarav", "Happy birthday from your moderator! 🎂", false, "sun", 72, 44, 2],
      ["u-meera", "See you at 4:30! 💖", true, "pink", 30, 74, -3],
    ].map(([authorId, message, isPrivate, color, x, y, rotation], i) => ({
      id: `wish-${i}`, celebrationId: riyaCel, authorId: authorId as string, message: message as string, isPrivate: isPrivate as boolean,
      color: color as WishColor, x: x as number, y: y as number, rotation: rotation as number, createdAt: now,
    })),
  };
}

function celebrationId(roomId: string, userId: string, date: string) {
  return `c.${roomId}.${userId}.${date}`;
}

// ---------------------------------------------------------------------------
// Store plumbing
// ---------------------------------------------------------------------------
let memory: Store | null = null;

function load(): Store {
  if (typeof window === "undefined") return (memory ??= seed());
  if (memory) return memory;
  const raw = window.localStorage.getItem(STORE_KEY);
  let store: Store | null = null;
  if (raw) {
    try {
      store = JSON.parse(raw) as Store;
    } catch {
      store = null;
    }
  }
  // Re-seed each day so "birthday tomorrow" stays true for the demo.
  if (!store || store.seededFor !== todayIST()) store = seed();
  memory = store;
  runReminders(store);
  persist(store, false);
  return store;
}

function persist(store: Store, notify = true) {
  memory = store;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  if (notify) window.dispatchEvent(new Event(EVENT));
}

function onChange(cb: () => void): Unsubscribe {
  if (typeof window === "undefined") return () => {};
  const local = () => cb();
  const remote = (e: StorageEvent) => {
    if (e.key === STORE_KEY) {
      memory = null;
      cb();
    }
  };
  window.addEventListener(EVENT, local);
  window.addEventListener("storage", remote);
  return () => {
    window.removeEventListener(EVENT, local);
    window.removeEventListener("storage", remote);
  };
}

// The demo user is per tab (sessionStorage), so two tabs can be two people.
// localStorage keeps the last choice for new tabs.
function currentUserId(): string | null {
  if (typeof window === "undefined") return null;
  const tab = window.sessionStorage.getItem(USER_KEY);
  if (tab !== null) return tab || null;
  return window.localStorage.getItem(USER_KEY);
}

export function setDemoUser(id: DemoUserId | null) {
  window.sessionStorage.setItem(USER_KEY, id ?? "");
  if (id) window.localStorage.setItem(USER_KEY, id);
  else window.localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function getDemoUser(): string | null {
  return currentUserId();
}

export function resetDemo() {
  window.localStorage.removeItem(STORE_KEY);
  memory = null;
  load();
  window.dispatchEvent(new Event(EVENT));
}

function requireUser(): string {
  const id = currentUserId();
  if (!id) throw new DataError("not_signed_in");
  return id;
}

function requireProfile(store: Store): Profile {
  const id = requireUser();
  const p = store.profiles.find((x) => x.id === id);
  if (!p) throw new DataError("profile_missing");
  return p;
}

function membership(store: Store, roomId: string, userId: string) {
  return store.memberships.find((m) => m.roomId === roomId && m.userId === userId);
}

function isMember(store: Store, roomId: string, userId: string) {
  return membership(store, roomId, userId)?.status === "approved";
}

function isAdmin(store: Store, roomId: string, userId: string) {
  const m = membership(store, roomId, userId);
  return m?.status === "approved" && (m.role === "moderator" || m.role === "co_moderator");
}

function isRep(store: Store, roomId: string, userId: string) {
  const m = membership(store, roomId, userId);
  return m?.status === "approved" && m.role !== "member";
}

function toPoll(store: Store, poll: StoredPoll, me: string): Poll {
  const options = poll.options
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((o) => ({ id: o.id, label: o.label, price: o.price, votes: store.pollVotes.filter((v) => v.optionId === o.id).length }));
  return {
    id: poll.id, roomId: poll.roomId, celebrationId: poll.celebrationId, question: poll.question, status: poll.status,
    winnerOptionId: poll.winnerOptionId, options, myVote: store.pollVotes.find((v) => v.pollId === poll.id && v.userId === me)?.optionId ?? null,
    totalVotes: options.reduce((n, o) => n + o.votes, 0),
  };
}

function memberCount(store: Store, roomId: string) {
  return store.memberships.filter((m) => m.roomId === roomId && m.status === "approved").length;
}

function approveExpense(store: Store, e: StoredExpense) {
  e.status = "approved";
  e.splitAmount = splitAmount(e.totalAmount, memberCount(store, e.roomId));
  for (const m of store.memberships) {
    if (m.roomId !== e.roomId || m.status !== "approved") continue;
    notify(store, m.userId, {
      roomId: e.roomId, celebrationId: null, kind: "expense_approved", title: `New split: ${e.title}`,
      body: `Your share is ₹${e.splitAmount}${e.dueDate ? ` · due ${formatISODayMonth(e.dueDate)}` : ""}.`, url: `/rooms/${e.roomId}?tab=expenses`,
    });
  }
}

function upsertExpensePayment(store: Store, expenseId: string, userId: string, paid: boolean, amount: number | null, recordedBy: string | null) {
  let k = store.expensePayments.find((x) => x.expenseId === expenseId && x.userId === userId);
  if (!k) {
    k = { expenseId, userId, amount: null, paidAt: null, recordedBy: null };
    store.expensePayments.push(k);
  }
  k.paidAt = paid ? k.paidAt ?? new Date().toISOString() : null;
  k.amount = amount;
  k.recordedBy = recordedBy;
}

function toExpense(store: Store, e: StoredExpense, me: string): Expense {
  const acc = store.upi.find((u) => u.id === e.upiAccountId) ?? null;
  const paid = store.expensePayments.filter((x) => x.expenseId === e.id && x.paidAt);
  const mine = store.expensePayments.find((x) => x.expenseId === e.id && x.userId === me);
  return {
    id: e.id, roomId: e.roomId, title: e.title, purpose: e.purpose, totalAmount: e.totalAmount, splitAmount: e.splitAmount,
    upi: acc ? { id: acc.id, upiId: acc.upiId, payeeName: acc.payeeName, qrImageUrl: acc.qrImageUrl } : null,
    dueDate: e.dueDate, status: e.status, createdById: e.createdBy, createdByName: store.profiles.find((x) => x.id === e.createdBy)?.fullName ?? null,
    paidCount: paid.length, eligibleCount: memberCount(store, e.roomId), collected: paid.reduce((n, x) => n + (x.amount ?? e.splitAmount ?? 0), 0),
    myPaidAt: mine?.paidAt ?? null, myAmount: mine?.amount ?? null,
  };
}

function isModerator(store: Store, roomId: string, userId: string) {
  const m = membership(store, roomId, userId);
  return m?.status === "approved" && m.role === "moderator";
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function newCode(store: Store) {
  for (;;) {
    let c = "";
    for (let i = 0; i < 6; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!store.rooms.some((r) => r.code === c)) return c;
  }
}

function notify(store: Store, userId: string, n: Omit<StoredNotification, "id" | "userId" | "createdAt" | "readAt" | "priority">) {
  if (n.celebrationId && store.notifications.some((x) => x.userId === userId && x.celebrationId === n.celebrationId && x.kind === n.kind)) {
    return;
  }
  store.notifications.unshift({ ...n, id: uid("n"), userId, createdAt: new Date().toISOString(), readAt: null, priority: isPriority(n.kind) });
}

/** Celebrations in the next `days` days for a room (all of them, including the caller's own). */
function roomCelebrations(store: Store, roomId: string, days = DECISION_WINDOW_DAYS): Celebration[] {
  const today = todayIST();
  const limit = addDays(today, days);
  const room = store.rooms.find((r) => r.id === roomId);
  return store.memberships
    .filter((m) => m.roomId === roomId && m.status === "approved")
    .flatMap((m) => {
      const p = store.profiles.find((x) => x.id === m.userId);
      if (!p) return [];
      const { month, day } = parseISODate(p.dob);
      const date = nextBirthday(month, day, today);
      if (date > limit) return [];
      const id = celebrationId(roomId, p.id, date);
      return [{
        id,
        roomId,
        birthdayUserId: p.id,
        birthdayName: p.fullName,
        date,
        status: date === today ? "live" : "upcoming",
        decision: store.decisions[id] ?? (room?.autoCelebrate ? "celebrate" : "pending"),
        purpose: store.celDetails[id]?.purpose ?? null,
        totalExpense: store.celDetails[id]?.totalExpense ?? null,
        plan: store.celDetails[id]?.plan ?? null,
        splitAmount: splitAmount(store.celDetails[id]?.totalExpense, memberCount(store, roomId) - 1),
      } satisfies Celebration];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function findCelebration(store: Store, id: string): Celebration | null {
  const [, roomId] = id.split(".");
  return roomCelebrations(store, roomId).find((c) => c.id === id) ?? null;
}

/** What the reminder job does (src/lib/reminders.ts), run on load and after changes. */
function runReminders(store: Store) {
  const today = todayIST();
  const time = timeIST();
  for (const room of store.rooms) {
    for (const c of roomCelebrations(store, room.id)) {
      const first = c.birthdayName.split(" ")[0]!;
      const due = dueReminders({ settings: room, decision: c.decision, date: c.date, today, time });
      const approved = store.memberships.filter((m) => m.roomId === room.id && m.status === "approved");
      for (const kind of due.toMembers) {
        const url = kind === "wish_reminder" ? `/rooms/${room.id}/wall/${c.id}` : `/rooms/${room.id}/surprise/${c.id}`;
        for (const m of approved) if (m.userId !== c.birthdayUserId) notify(store, m.userId, { roomId: room.id, celebrationId: c.id, kind, ...reminderText(kind, first, room.name), url });
      }
      for (const kind of due.toBirthdayPerson) {
        notify(store, c.birthdayUserId, { roomId: room.id, celebrationId: c.id, kind, ...reminderText(kind, first, room.name), url: `/rooms/${room.id}/wall/${c.id}` });
      }
      for (const kind of due.toAdmins) {
        for (const m of approved) {
          if (!isAdminRole(m.role) || m.userId === c.birthdayUserId) continue;
          notify(store, m.userId, { roomId: room.id, celebrationId: c.id, kind, ...reminderText(kind, first, room.name), url: `/rooms/${room.id}/manage?tab=birthdays` });
        }
      }
    }
  }
}

function toRoom(r: StoredRoom, m: StoredMembership): Room {
  const admin = m.status === "approved" && isAdminRole(m.role);
  return {
    id: r.id, name: r.name, code: admin ? r.code : null, amountMode: r.amountMode, amount: r.amount,
    payersPerUpi: r.payersPerUpi, remindWeekBefore: r.remindWeekBefore, remindDayBefore: r.remindDayBefore,
    remindOnDay: r.remindOnDay, remindWeekBeforeAt: r.remindWeekBeforeAt, remindDayBeforeAt: r.remindDayBeforeAt,
    remindOnDayAt: r.remindOnDayAt, sendBirthdayWish: r.sendBirthdayWish, autoCelebrate: r.autoCelebrate,
    createdBy: r.createdBy, myRole: m.role, myStatus: m.status,
  };
}

const delay = <T,>(v: T, ms = 120) => new Promise<T>((res) => setTimeout(() => res(v), ms));

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------
export const mockApi: DataApi = {
  mode: "mock",

  async getSession(): Promise<Session | null> {
    const id = currentUserId();
    if (!id) return null;
    const store = load();
    const profile = store.profiles.find((p) => p.id === id) ?? null;
    return delay({ userId: id, email: store.emails[id] ?? `${id.slice(2)}@example.com`, suggestedName: profile ? null : "New Student", profile }, 40);
  },

  async signInWithGoogle() {
    if (!currentUserId()) setDemoUser("u-kabir");
  },

  async signOut() {
    setDemoUser(null);
  },

  async usernameAvailable(name) {
    const store = load();
    const me = currentUserId();
    return delay(!store.profiles.some((p) => p.username === name.toLowerCase() && p.id !== me), 200);
  },

  async saveProfile(input: ProfileInput) {
    const id = requireUser();
    const store = load();
    const name = input.username.toLowerCase();
    if (!/^[a-z0-9._]{3,24}$/.test(name)) throw new DataError("invalid_input", "Username must be 3–24 characters: a–z, 0–9, dot or underscore.");
    if (store.profiles.some((p) => p.username === name && p.id !== id)) throw new DataError("username_taken");
    const existing = store.profiles.find((p) => p.id === id);
    // Date of birth is locked once saved (as in the database).
    if (existing) Object.assign(existing, { fullName: input.fullName.trim(), username: name });
    else store.profiles.push({ id, fullName: input.fullName.trim(), username: name, dob: input.dob, avatarUrl: null });
    persist(store);
  },

  async previewRoom(code): Promise<RoomPreview | null> {
    const me = requireUser();
    const store = load();
    const r = store.rooms.find((x) => x.code === code.trim().toUpperCase());
    if (!r) return delay(null, 250);
    const mod = store.memberships.find((m) => m.roomId === r.id && m.role === "moderator");
    const modName = store.profiles.find((p) => p.id === mod?.userId)?.fullName.split(" ")[0] ?? null;
    return delay({
      roomId: r.id,
      name: r.name,
      memberCount: store.memberships.filter((m) => m.roomId === r.id && m.status === "approved").length,
      moderatorFirstName: modName,
      myStatus: membership(store, r.id, me)?.status ?? null,
    }, 250);
  },

  async requestJoin(code) {
    const store = load();
    const me = requireProfile(store);
    const r = store.rooms.find((x) => x.code === code.trim().toUpperCase());
    if (!r) throw new DataError("room_not_found");
    const existing = membership(store, r.id, me.id);
    if (existing && existing.status !== "declined") return { roomId: r.id, status: existing.status };
    if (existing) Object.assign(existing, { status: "pending", requestedAt: new Date().toISOString() });
    else store.memberships.push({ roomId: r.id, userId: me.id, role: "member", status: "pending", requestedAt: new Date().toISOString() });
    for (const m of store.memberships) {
      if (m.roomId === r.id && m.status === "approved" && isAdminRole(m.role)) {
        notify(store, m.userId, { roomId: r.id, celebrationId: null, kind: "join_request", title: "New join request", body: `${me.fullName} wants to join ${r.name}`, url: `/rooms/${r.id}/manage` });
      }
    }
    persist(store);
    return { roomId: r.id, status: "pending" as MemberStatus };
  },

  async myRooms() {
    const me = requireUser();
    const store = load();
    return delay(
      store.memberships
        .filter((m) => m.userId === me && m.status !== "declined")
        .map((m) => {
          const r = store.rooms.find((x) => x.id === m.roomId)!;
          return { id: r.id, name: r.name, myRole: m.role, myStatus: m.status };
        }),
      60,
    );
  },

  async getRoom(roomId) {
    const me = requireUser();
    const store = load();
    const r = store.rooms.find((x) => x.id === roomId);
    const m = membership(store, roomId, me);
    if (!r || !m) return delay(null, 40);
    return delay(toRoom(r, m), 60);
  },

  async createRoom(input: CreateRoomInput) {
    const store = load();
    const me = requireProfile(store);
    const room: StoredRoom = {
      id: uid("r"), name: input.name.trim(), code: newCode(store), amountMode: input.amountMode,
      amount: input.amountMode === "any" ? null : input.amount, payersPerUpi: input.payersPerUpi,
      remindWeekBefore: input.remindWeekBefore, remindDayBefore: input.remindDayBefore, remindOnDay: input.remindOnDay,
      remindWeekBeforeAt: input.remindWeekBeforeAt, remindDayBeforeAt: input.remindDayBeforeAt, remindOnDayAt: input.remindOnDayAt,
      sendBirthdayWish: input.sendBirthdayWish, autoCelebrate: input.autoCelebrate,
      createdBy: me.id,
    };
    store.rooms.push(room);
    store.memberships.push({ roomId: room.id, userId: me.id, role: "moderator", status: "approved", requestedAt: new Date().toISOString() });
    input.upiAccounts.forEach((a, i) => {
      store.upi.push({ id: uid("upi"), roomId: room.id, upiId: a.upiId.trim(), payeeName: a.payeeName.trim(), ownerUserId: a.ownerUserId, qrImageUrl: a.qrImageUrl, sortOrder: i, active: true });
    });
    persist(store);
    return delay({ roomId: room.id, code: room.code }, 300);
  },

  async updateRoom(roomId, input: RoomSettingsInput) {
    const me = requireUser();
    const store = load();
    if (!isAdmin(store, roomId, me)) throw new DataError("not_allowed");
    const r = store.rooms.find((x) => x.id === roomId)!;
    Object.assign(r, { ...input, name: input.name.trim(), amount: input.amountMode === "any" ? null : input.amount });
    runReminders(store);
    persist(store);
  },

  async deleteRoom(roomId) {
    const me = requireUser();
    const store = load();
    if (!isModerator(store, roomId, me)) throw new DataError("not_allowed", "Only the moderator can delete the room.");
    const prefix = `c.${roomId}.`;
    store.rooms = store.rooms.filter((r) => r.id !== roomId);
    store.memberships = store.memberships.filter((m) => m.roomId !== roomId);
    store.upi = store.upi.filter((u) => u.roomId !== roomId);
    store.notifications = store.notifications.filter((n) => n.roomId !== roomId);
    store.contributions = store.contributions.filter((c) => !c.celebrationId.startsWith(prefix));
    for (const k of Object.keys(store.decisions)) if (k.startsWith(prefix)) delete store.decisions[k];
    persist(store);
  },

  async regenerateCode(roomId) {
    const me = requireUser();
    const store = load();
    if (!isAdmin(store, roomId, me)) throw new DataError("not_allowed");
    const r = store.rooms.find((x) => x.id === roomId)!;
    r.code = newCode(store);
    persist(store);
    return r.code;
  },

  async leaveRoom(roomId) {
    const me = requireUser();
    const store = load();
    const m = membership(store, roomId, me);
    if (m?.role === "moderator") throw new DataError("not_allowed", "Moderators can't leave their own room.");
    store.memberships = store.memberships.filter((x) => !(x.roomId === roomId && x.userId === me));
    persist(store);
  },

  async listMembers(roomId) {
    const me = requireUser();
    const store = load();
    if (!isMember(store, roomId, me)) return [];
    const admin = isAdmin(store, roomId, me);
    return delay(
      store.memberships
        .filter((m) => m.roomId === roomId && (m.status === "approved" || (admin && m.status === "pending")))
        .map((m): Member => {
          const p = store.profiles.find((x) => x.id === m.userId)!;
          const { month, day } = parseISODate(p.dob);
          return { userId: p.id, fullName: p.fullName, username: p.username, avatarUrl: p.avatarUrl, birthMonth: month, birthDay: day, role: m.role, status: m.status, requestedAt: m.requestedAt };
        })
        .sort((a, b) => a.status.localeCompare(b.status) || a.fullName.localeCompare(b.fullName)),
      80,
    );
  },

  async decideRequest(roomId, userId, approve) {
    const me = requireUser();
    const store = load();
    if (!isAdmin(store, roomId, me)) throw new DataError("not_allowed");
    const m = membership(store, roomId, userId);
    if (!m || m.status !== "pending") throw new DataError("not_found");
    m.status = approve ? "approved" : "declined";
    const r = store.rooms.find((x) => x.id === roomId)!;
    notify(store, userId, approve
      ? { roomId, celebrationId: null, kind: "join_approved", title: "You're in!", body: `Welcome to ${r.name}`, url: `/rooms/${roomId}` }
      : { roomId, celebrationId: null, kind: "join_declined", title: "Join request declined", body: `Your request to join ${r.name} was declined.`, url: "/join" });
    runReminders(store);
    persist(store);
  },

  async setMemberRole(roomId, userId, role) {
    const me = requireUser();
    const store = load();
    if (!isModerator(store, roomId, me) || userId === me) throw new DataError("not_allowed");
    const m = membership(store, roomId, userId);
    if (!m || m.status !== "approved" || m.role === "moderator") throw new DataError("not_found");
    m.role = role;
    persist(store);
  },

  async removeMember(roomId, userId) {
    const me = requireUser();
    const store = load();
    if (!isAdmin(store, roomId, me)) throw new DataError("not_allowed");
    const m = membership(store, roomId, userId);
    if (!m || m.role === "moderator" || (m.role === "co_moderator" && !isModerator(store, roomId, me))) throw new DataError("not_allowed");
    store.memberships = store.memberships.filter((x) => x !== m);
    persist(store);
  },

  onMembershipChange(roomId, cb) {
    let last = (() => {
      const me = currentUserId();
      return me ? membership(load(), roomId, me)?.status : undefined;
    })();
    return onChange(() => {
      const me = currentUserId();
      if (!me) return;
      const status = membership(load(), roomId, me)?.status;
      if (status && status !== last) {
        last = status;
        cb(status);
      }
    });
  },

  async listUpiAccounts(roomId) {
    const me = requireUser();
    const store = load();
    if (!isAdmin(store, roomId, me)) throw new DataError("not_allowed");
    return store.upi.filter((u) => u.roomId === roomId).sort((a, b) => a.sortOrder - b.sortOrder).map(({ roomId: _r, ...u }) => u);
  },

  async addUpiAccount(roomId, input) {
    const me = requireUser();
    const store = load();
    if (!isAdmin(store, roomId, me)) throw new DataError("not_allowed");
    const order = Math.max(-1, ...store.upi.filter((u) => u.roomId === roomId).map((u) => u.sortOrder)) + 1;
    store.upi.push({ id: uid("upi"), roomId, upiId: input.upiId.trim(), payeeName: input.payeeName.trim(), ownerUserId: input.ownerUserId, qrImageUrl: input.qrImageUrl, sortOrder: order, active: true });
    persist(store);
  },

  async updateUpiAccount(roomId, accountId, patch) {
    const me = requireUser();
    const store = load();
    if (!isAdmin(store, roomId, me)) throw new DataError("not_allowed");
    const a = store.upi.find((u) => u.id === accountId && u.roomId === roomId);
    if (!a) throw new DataError("not_found");
    Object.assign(a, patch);
    persist(store);
  },

  async deleteUpiAccount(roomId, accountId) {
    const me = requireUser();
    const store = load();
    if (!isAdmin(store, roomId, me)) throw new DataError("not_allowed");
    store.upi = store.upi.filter((u) => !(u.id === accountId && u.roomId === roomId));
    for (const k of store.contributions) if (k.upiAccountId === accountId) k.upiAccountId = null;
    persist(store);
  },

  async uploadQrImage(_roomId, file) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new DataError("unknown", "Could not read the image."));
      reader.readAsDataURL(file);
    });
  },

  async upcomingCelebrations(roomId) {
    const me = requireUser();
    const store = load();
    if (!isMember(store, roomId, me)) return [];
    const week = addDays(todayIST(), 7);
    return delay(roomCelebrations(store, roomId).filter((c) => c.birthdayUserId !== me && c.decision === "celebrate" && c.date <= week), 60);
  },

  async adminCelebrations(roomId) {
    const me = requireUser();
    const store = load();
    if (!isAdmin(store, roomId, me)) throw new DataError("not_allowed");
    return delay(roomCelebrations(store, roomId).filter((c) => c.birthdayUserId !== me), 60);
  },

  async setCelebrationDecision(id, decision) {
    const me = requireUser();
    const store = load();
    const c = findCelebration(store, id);
    if (!c || c.birthdayUserId === me || !isAdmin(store, c.roomId, me)) throw new DataError("not_allowed");
    store.decisions[id] = decision;
    runReminders(store);
    persist(store);
  },

  async getCelebration(id) {
    const me = requireUser();
    const store = load();
    const c = findCelebration(store, id);
    if (!c || c.birthdayUserId === me || !isMember(store, c.roomId, me)) return null;
    // Members only see approved celebrations; admins see every decision.
    if (c.decision !== "celebrate" && !isAdmin(store, c.roomId, me)) return null;
    return c;
  },

  async openSurprise(id): Promise<Surprise> {
    const me = requireUser();
    const store = load();
    const c = findCelebration(store, id);
    if (!c || c.birthdayUserId === me || !isMember(store, c.roomId, me) || c.decision !== "celebrate") throw new DataError("not_found");
    const room = store.rooms.find((r) => r.id === c.roomId)!;
    let mine = store.contributions.find((x) => x.celebrationId === id && x.userId === me);
    let allFull = false;
    const activeIds = new Set(store.upi.filter((u) => u.roomId === c.roomId && u.active).map((u) => u.id));
    if (!mine || !mine.upiAccountId || !activeIds.has(mine.upiAccountId)) {
      const pick = pickUpiAccount(
        store.upi.filter((u) => u.roomId === c.roomId).map((u) => ({
          id: u.id, ownerUserId: u.ownerUserId, sortOrder: u.sortOrder, active: u.active,
          assignedCount: store.contributions.filter((x) => x.celebrationId === id && x.upiAccountId === u.id).length,
        })),
        c.birthdayUserId,
        room.payersPerUpi,
      );
      allFull = pick.allFull;
      if (!mine) {
        mine = { celebrationId: id, userId: me, upiAccountId: pick.accountId, amount: null, paidAt: null };
        store.contributions.push(mine);
      } else mine.upiAccountId = pick.accountId;
      if (allFull) {
        for (const m of store.memberships) {
          if (m.roomId === room.id && m.status === "approved" && isAdminRole(m.role) && m.userId !== c.birthdayUserId) {
            notify(store, m.userId, { roomId: room.id, celebrationId: id, kind: "upi_full", title: "All UPI IDs are full", body: `Every UPI ID in ${room.name} has reached ${room.payersPerUpi} payers. Add another one.`, url: `/rooms/${room.id}/manage/edit` });
          }
        }
      }
      persist(store);
    }
    const acc = store.upi.find((u) => u.id === mine!.upiAccountId) ?? null;
    return delay({
      celebrationId: id, roomId: c.roomId, birthdayName: c.birthdayName, date: c.date,
      upi: acc ? { id: acc.id, upiId: acc.upiId, payeeName: acc.payeeName, qrImageUrl: acc.qrImageUrl } : null,
      amountMode: room.amountMode, amount: room.amount, allUpiFull: allFull,
      myPaidAt: mine.paidAt, myAmount: mine.amount,
      purpose: c.purpose, plan: c.plan, totalExpense: c.totalExpense, splitAmount: c.splitAmount,
    }, 200);
  },

  async markPaid(id, paid, amount) {
    const me = requireUser();
    const store = load();
    const c = findCelebration(store, id);
    if (!c || c.birthdayUserId === me || !isMember(store, c.roomId, me) || c.decision !== "celebrate") throw new DataError("not_found");
    const room = store.rooms.find((r) => r.id === c.roomId)!;
    let mine = store.contributions.find((x) => x.celebrationId === id && x.userId === me);
    if (!mine) {
      mine = { celebrationId: id, userId: me, upiAccountId: null, amount: null, paidAt: null };
      store.contributions.push(mine);
    }
    if (c.splitAmount != null) {
      const value = amount ?? c.splitAmount;
      const problem = paid ? checkContribution(value, c.splitAmount) : null;
      if (problem) throw new DataError("invalid_input", problem);
      mine.amount = value;
    } else if (room.amountMode !== "fixed" && amount != null) mine.amount = amount;
    mine.paidAt = paid ? mine.paidAt ?? new Date().toISOString() : null;
    mine.recordedBy = null;
    persist(store);
  },

  async getPool(id): Promise<Pool> {
    const me = requireUser();
    const store = load();
    const c = findCelebration(store, id);
    if (!c || c.birthdayUserId === me || !isMember(store, c.roomId, me)) throw new DataError("not_found");
    if (c.decision !== "celebrate" && !isAdmin(store, c.roomId, me)) throw new DataError("not_found");
    const room = store.rooms.find((r) => r.id === c.roomId)!;
    const paid = store.contributions.filter((x) => x.celebrationId === id && x.paidAt);
    return {
      paidCount: paid.length,
      eligibleCount: store.memberships.filter((m) => m.roomId === c.roomId && m.status === "approved" && m.userId !== c.birthdayUserId).length,
      totalAmount: paid.reduce((s, x) => s + (room.amountMode === "fixed" ? room.amount ?? 0 : x.amount ?? room.amount ?? 0), 0),
    };
  },

  async getPayers(id): Promise<Payer[]> {
    const me = requireUser();
    const store = load();
    const c = findCelebration(store, id);
    if (!c || c.birthdayUserId === me || !isRep(store, c.roomId, me)) throw new DataError("not_found");
    return store.memberships
      .filter((m) => m.roomId === c.roomId && m.status === "approved" && m.userId !== c.birthdayUserId)
      .map((m) => {
        const p = store.profiles.find((x) => x.id === m.userId)!;
        const k = store.contributions.find((x) => x.celebrationId === id && x.userId === m.userId);
        return { userId: p.id, fullName: p.fullName, username: p.username, upiId: store.upi.find((u) => u.id === k?.upiAccountId)?.upiId ?? null, amount: k?.amount ?? null, paidAt: k?.paidAt ?? null, recordedBy: k?.recordedBy ?? null };
      })
      .sort((a, b) => (a.paidAt ? 0 : 1) - (b.paidAt ? 0 : 1) || a.fullName.localeCompare(b.fullName));
  },

  onPoolChange(_id, cb) {
    return onChange(cb);
  },

  async setCelebrationDetails(id, input) {
    const me = requireUser();
    const store = load();
    const c = findCelebration(store, id);
    if (!c || c.birthdayUserId === me || !isAdmin(store, c.roomId, me)) throw new DataError("not_allowed");
    store.celDetails[id] = {
      purpose: input.purpose?.trim() || null,
      totalExpense: input.totalExpense && input.totalExpense > 0 ? Math.round(input.totalExpense) : null,
      plan: input.plan?.trim() || null,
    };
    persist(store);
  },

  async recordCelebrationPayment(id, userId, paid, amount) {
    const me = requireUser();
    const store = load();
    const c = findCelebration(store, id);
    if (!c || c.birthdayUserId === me || c.birthdayUserId === userId || !isRep(store, c.roomId, me) || c.decision !== "celebrate") {
      throw new DataError("not_allowed");
    }
    const room = store.rooms.find((r) => r.id === c.roomId)!;
    const value = amount ?? c.splitAmount ?? room.amount;
    const problem = paid ? checkContribution(value, c.splitAmount) : null;
    if (problem) throw new DataError("invalid_input", problem);
    let k = store.contributions.find((x) => x.celebrationId === id && x.userId === userId);
    if (!k) {
      k = { celebrationId: id, userId, upiAccountId: null, amount: null, paidAt: null };
      store.contributions.push(k);
    }
    k.paidAt = paid ? k.paidAt ?? new Date().toISOString() : null;
    k.amount = value ?? k.amount;
    k.recordedBy = me;
    persist(store);
  },

  async getPoll(celebrationId) {
    const me = requireUser();
    const store = load();
    const c = findCelebration(store, celebrationId);
    if (!c || c.birthdayUserId === me || !isMember(store, c.roomId, me)) return null;
    if (c.decision !== "celebrate" && !isAdmin(store, c.roomId, me)) return null;
    const poll = store.polls.find((x) => x.celebrationId === celebrationId);
    return poll ? toPoll(store, poll, me) : null;
  },

  async createPoll(celebrationId, question, options) {
    const me = requireUser();
    const store = load();
    const c = findCelebration(store, celebrationId);
    if (!c || c.birthdayUserId === me || !isAdmin(store, c.roomId, me)) throw new DataError("not_allowed");
    if (store.polls.some((x) => x.celebrationId === celebrationId)) throw new DataError("invalid_input", "This birthday already has a vote.");
    if (options.length < 2 || options.length > 8) throw new DataError("invalid_input", "Add 2 to 8 options.");
    const poll: StoredPoll = {
      id: uid("poll"), roomId: c.roomId, celebrationId, question: question.trim(), status: "open", winnerOptionId: null,
      options: options.map((o, i) => ({ id: uid("opt"), label: o.label.trim(), price: o.price, sortOrder: i })),
    };
    store.polls.push(poll);
    if (c.decision === "celebrate") {
      const first = c.birthdayName.split(" ")[0];
      for (const m of store.memberships) {
        if (m.roomId !== c.roomId || m.status !== "approved" || m.userId === c.birthdayUserId) continue;
        notify(store, m.userId, { roomId: c.roomId, celebrationId, kind: "poll_open", title: `Vote: ${poll.question}`, body: `Pick one before the vote closes. Don't tell ${first}.`, url: `/rooms/${c.roomId}/surprise/${celebrationId}` });
      }
    }
    persist(store);
  },

  async votePoll(pollId, optionId) {
    const me = requireUser();
    const store = load();
    const poll = store.polls.find((x) => x.id === pollId);
    if (!poll || poll.status !== "open" || !poll.options.some((o) => o.id === optionId)) throw new DataError("not_allowed");
    const c = poll.celebrationId ? findCelebration(store, poll.celebrationId) : null;
    if (c && (c.birthdayUserId === me || !isMember(store, c.roomId, me))) throw new DataError("not_allowed");
    store.pollVotes = store.pollVotes.filter((v) => !(v.pollId === pollId && v.userId === me));
    store.pollVotes.push({ pollId, userId: me, optionId });
    persist(store);
  },

  async closePoll(pollId) {
    const me = requireUser();
    const store = load();
    const poll = store.polls.find((x) => x.id === pollId);
    if (!poll || !isAdmin(store, poll.roomId, me)) throw new DataError("not_allowed");
    const winner = pickWinner(poll.options.map((o) => ({ id: o.id, price: o.price, sortOrder: o.sortOrder, votes: store.pollVotes.filter((v) => v.optionId === o.id).length })));
    poll.status = "closed";
    poll.winnerOptionId = winner;
    const w = poll.options.find((o) => o.id === winner);
    if (poll.celebrationId && w?.price) {
      const d = store.celDetails[poll.celebrationId] ?? { purpose: null, totalExpense: null, plan: null };
      store.celDetails[poll.celebrationId] = { ...d, totalExpense: w.price, purpose: d.purpose ?? w.label };
    }
    persist(store);
  },

  async deletePoll(pollId) {
    const me = requireUser();
    const store = load();
    const poll = store.polls.find((x) => x.id === pollId);
    if (!poll || !isAdmin(store, poll.roomId, me)) throw new DataError("not_allowed");
    store.polls = store.polls.filter((x) => x.id !== pollId);
    store.pollVotes = store.pollVotes.filter((v) => v.pollId !== pollId);
    persist(store);
  },

  async listExpenses(roomId) {
    const me = requireUser();
    const store = load();
    if (!isMember(store, roomId, me)) return [];
    const rep = isRep(store, roomId, me);
    return delay(
      store.expenses
        .filter((e) => e.roomId === roomId && (rep || e.status === "approved" || e.status === "closed"))
        .sort((a, b) => Number(b.status === "requested") - Number(a.status === "requested") || b.createdAt.localeCompare(a.createdAt))
        .map((e) => toExpense(store, e, me)),
      80,
    );
  },

  async listUpiChoices(roomId) {
    const me = requireUser();
    const store = load();
    if (!isRep(store, roomId, me)) throw new DataError("not_allowed");
    return store.upi.filter((u) => u.roomId === roomId && u.active).sort((a, b) => a.sortOrder - b.sortOrder).map((u) => ({ id: u.id, upiId: u.upiId, payeeName: u.payeeName }));
  },

  async requestExpense(roomId, input) {
    const me = requireUser();
    const store = load();
    if (!isRep(store, roomId, me)) throw new DataError("not_allowed");
    if (!input.title.trim() || !(input.totalAmount > 0)) throw new DataError("invalid_input", "Add a title and a total.");
    const e: StoredExpense = {
      id: uid("exp"), roomId, title: input.title.trim(), purpose: input.purpose?.trim() || null, totalAmount: Math.round(input.totalAmount),
      splitAmount: null, upiAccountId: input.upiAccountId, dueDate: input.dueDate, status: "requested", createdBy: me, createdAt: new Date().toISOString(),
    };
    store.expenses.push(e);
    if (isAdmin(store, roomId, me)) approveExpense(store, e);
    else {
      const who = store.profiles.find((x) => x.id === me)?.fullName ?? "A class rep";
      for (const m of store.memberships) {
        if (m.roomId === roomId && m.status === "approved" && (m.role === "moderator" || m.role === "co_moderator")) {
          notify(store, m.userId, { roomId, celebrationId: null, kind: "expense_request", title: `Split request: ${e.title}`, body: `${who} wants to split ₹${e.totalAmount}. Approve it before the class sees it.`, url: `/rooms/${roomId}/manage?tab=expenses` });
        }
      }
    }
    persist(store);
  },

  async decideExpense(expenseId, approve) {
    const me = requireUser();
    const store = load();
    const e = store.expenses.find((x) => x.id === expenseId);
    if (!e || !isAdmin(store, e.roomId, me)) throw new DataError("not_allowed");
    if (e.status !== "requested") throw new DataError("invalid_input", "Already decided.");
    if (approve) approveExpense(store, e);
    else e.status = "declined";
    persist(store);
  },

  async markExpensePaid(expenseId, paid, amount) {
    const me = requireUser();
    const store = load();
    const e = store.expenses.find((x) => x.id === expenseId);
    if (!e || e.status !== "approved" || !isMember(store, e.roomId, me)) throw new DataError("not_found");
    const value = amount ?? e.splitAmount;
    const problem = paid ? checkContribution(value, e.splitAmount) : null;
    if (problem) throw new DataError("invalid_input", problem);
    upsertExpensePayment(store, expenseId, me, paid, value, null);
    persist(store);
  },

  async getExpensePayers(expenseId) {
    const me = requireUser();
    const store = load();
    const e = store.expenses.find((x) => x.id === expenseId);
    if (!e || !isRep(store, e.roomId, me)) throw new DataError("not_allowed");
    return store.memberships
      .filter((m) => m.roomId === e.roomId && m.status === "approved")
      .map((m): Payer => {
        const p = store.profiles.find((x) => x.id === m.userId)!;
        const k = store.expensePayments.find((x) => x.expenseId === expenseId && x.userId === m.userId);
        return { userId: p.id, fullName: p.fullName, username: p.username, upiId: null, amount: k?.amount ?? null, paidAt: k?.paidAt ?? null, recordedBy: k?.recordedBy ?? null };
      })
      .sort((a, b) => (a.paidAt ? 0 : 1) - (b.paidAt ? 0 : 1) || a.fullName.localeCompare(b.fullName));
  },

  async recordExpensePayment(expenseId, userId, paid, amount) {
    const me = requireUser();
    const store = load();
    const e = store.expenses.find((x) => x.id === expenseId);
    if (!e || e.status !== "approved" || !isRep(store, e.roomId, me) || !isMember(store, e.roomId, userId)) throw new DataError("not_allowed");
    const value = amount ?? e.splitAmount;
    const problem = paid ? checkContribution(value, e.splitAmount) : null;
    if (problem) throw new DataError("invalid_input", problem);
    upsertExpensePayment(store, expenseId, userId, paid, value, me);
    persist(store);
  },

  async closeExpense(expenseId) {
    const me = requireUser();
    const store = load();
    const e = store.expenses.find((x) => x.id === expenseId);
    if (!e || !isAdmin(store, e.roomId, me)) throw new DataError("not_allowed");
    e.status = "closed";
    persist(store);
  },

  async deleteExpense(expenseId) {
    const me = requireUser();
    const store = load();
    const e = store.expenses.find((x) => x.id === expenseId);
    if (!e || !(isAdmin(store, e.roomId, me) || (e.createdBy === me && e.status === "requested"))) throw new DataError("not_allowed");
    store.expenses = store.expenses.filter((x) => x.id !== expenseId);
    store.expensePayments = store.expensePayments.filter((x) => x.expenseId !== expenseId);
    persist(store);
  },

  async getWall(celebrationId) {
    const me = requireUser();
    const store = load();
    const [, roomId, bdayId, date] = celebrationId.split(".");
    if (!roomId || !bdayId || !date || !isMember(store, roomId, me)) return null;
    const isMe = bdayId === me;
    const today = todayIST();
    if (isMe && today < date) return null;
    const room = store.rooms.find((r) => r.id === roomId);
    const bday = store.profiles.find((x) => x.id === bdayId);
    if (!room || !bday) return null;
    const decision = store.decisions[celebrationId] ?? (room.autoCelebrate ? "celebrate" : "pending");
    const all = store.wishes.filter((w) => w.celebrationId === celebrationId);
    const visible = all.filter((w) => isMe || !w.isPrivate || w.authorId === me);
    return delay({
      info: {
        celebrationId, roomId, roomName: room.name, birthdayName: bday.fullName, date, revealed: today >= date, isBirthdayPerson: isMe,
        plan: isMe || decision === "celebrate" || isAdmin(store, roomId, me) ? store.celDetails[celebrationId]?.plan ?? null : null,
        wishCount: all.length,
      },
      wishes: visible.map((w) => ({ ...w, authorName: store.profiles.find((x) => x.id === w.authorId)?.fullName ?? "A classmate", mine: w.authorId === me })),
    }, 80);
  },

  async addWish(celebrationId, input) {
    const me = requireUser();
    const store = load();
    const [, roomId, bdayId] = celebrationId.split(".");
    if (!roomId || bdayId === me || !isMember(store, roomId, me)) throw new DataError("not_found");
    if (!input.message.trim()) throw new DataError("invalid_input", "Write something first.");
    if (store.wishes.filter((w) => w.celebrationId === celebrationId && w.authorId === me).length >= 5) throw new DataError("invalid_input", "Up to 5 notes each.");
    store.wishes.push({
      id: uid("wish"), celebrationId, authorId: me, message: input.message.trim().slice(0, 500), isPrivate: input.isPrivate, color: input.color,
      x: 4 + Math.random() * 70, y: 4 + Math.random() * 72, rotation: -6 + Math.random() * 12, createdAt: new Date().toISOString(),
    });
    persist(store);
  },

  async moveWish(wishId, x, y) {
    const me = requireUser();
    const store = load();
    const w = store.wishes.find((v) => v.id === wishId);
    if (!w) throw new DataError("not_found");
    const [, , bdayId, date] = w.celebrationId.split(".");
    const canMove = w.authorId === me || (bdayId === me && todayIST() >= (date ?? ""));
    if (!canMove) throw new DataError("not_allowed");
    w.x = Math.min(100, Math.max(0, x));
    w.y = Math.min(100, Math.max(0, y));
    persist(store);
  },

  async deleteWish(wishId) {
    const me = requireUser();
    const store = load();
    const w = store.wishes.find((v) => v.id === wishId);
    if (!w) throw new DataError("not_found");
    const [, roomId, bdayId] = w.celebrationId.split(".");
    if (!(w.authorId === me || (isAdmin(store, roomId!, me) && bdayId !== me))) throw new DataError("not_allowed");
    store.wishes = store.wishes.filter((v) => v.id !== wishId);
    persist(store);
  },

  async myBirthdayWalls() {
    const me = currentUserId();
    if (!me) return [];
    const store = load();
    const today = todayIST();
    const out: { celebrationId: string; roomId: string; roomName: string; date: string; wishCount: number }[] = [];
    for (const m of store.memberships) {
      if (m.userId !== me || m.status !== "approved") continue;
      const p = store.profiles.find((x) => x.id === me);
      const room = store.rooms.find((r) => r.id === m.roomId);
      if (!p || !room) continue;
      const { month, day } = parseISODate(p.dob);
      const date = birthdayInYear(month, day, Number(today.slice(0, 4)));
      if (date > today || daysBetween(date, today) > 30) continue;
      const id = celebrationId(room.id, me, date);
      out.push({ celebrationId: id, roomId: room.id, roomName: room.name, date, wishCount: store.wishes.filter((w) => w.celebrationId === id).length });
    }
    return out;
  },

  async listNotifications() {
    const me = currentUserId();
    if (!me) return [];
    return load().notifications.filter((n) => n.userId === me).map(({ userId: _u, ...n }) => n);
  },

  async markNotificationsRead(ids) {
    const me = requireUser();
    const store = load();
    const now = new Date().toISOString();
    for (const n of store.notifications) if (n.userId === me && !n.readAt && (!ids || ids.includes(n.id))) n.readAt = now;
    persist(store);
  },

  onNotification(cb) {
    let seen = new Set(load().notifications.map((n) => n.id));
    return onChange(() => {
      const me = currentUserId();
      const all = load().notifications;
      for (const n of all) if (!seen.has(n.id) && n.userId === me) cb(n);
      seen = new Set(all.map((n) => n.id));
    });
  },

  async savePushSubscription() {
    // The mock keeps nothing; the service worker still shows local test pushes.
  },

  async deletePushSubscription() {},

  async sendTestPush() {
    // No server in demo mode: show the notification locally through the service worker.
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification("Test notification", { body: "Demo mode: this one comes from your browser, not the server.", icon: "/icons/192", tag: "bdap-test" });
    return { devices: 1, sent: 1, failed: 0, gone: 0 };
  },
};

/** Lets pages re-render when the mock store changes (demo user switch etc.). */
export function onMockChange(cb: () => void): Unsubscribe {
  return onChange(cb);
}
