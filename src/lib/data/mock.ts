"use client";
// In-memory sample data for building pages without a backend.
// State lives in localStorage so it survives reloads and syncs across tabs
// (open two tabs as different demo users to see "realtime" approvals).
// Switch users with the demo switcher (bottom of every page in mock mode).

import { addDays, nextBirthday, parseISODate, todayIST } from "@/lib/dates";
import { pickUpiAccount } from "@/lib/upi";
import {
  DataError,
  type AppNotification,
  type Celebration,
  type CreateRoomInput,
  type Member,
  type MemberStatus,
  type NotificationKind,
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

const STORE_KEY = "bdap-mock-v1";
const USER_KEY = "bdap-mock-user";
const EVENT = "bdap-mock-change";
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// ---------------------------------------------------------------------------
// Demo users
// ---------------------------------------------------------------------------
export const DEMO_USERS = [
  { id: "u-kabir", label: "Member", hint: "Kabir · sees the surprise" },
  { id: "u-aarav", label: "Moderator", hint: "Aarav · runs CSE B" },
  { id: "u-riya", label: "Birthday person", hint: "Riya · birthday tomorrow" },
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
    { id: "u-riya", fullName: "Riya Kapoor", username: "riya.k", dob: dobFromDate(addDays(today, 1)), avatarUrl: null },
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
      payersPerUpi: 20, remindWeekBefore: false, remindDayBefore: true, remindOnDay: true, createdBy: "u-aarav",
    },
    {
      id: "r-hostel", name: "Hostel Block C", code: "HSTLC7", amountMode: "fixed", amount: 30,
      payersPerUpi: 20, remindWeekBefore: true, remindDayBefore: true, remindOnDay: true, createdBy: "u-meera",
    },
  ];

  const memberships: StoredMembership[] = [
    { roomId: "r-cseb", userId: "u-aarav", role: "moderator", status: "approved", requestedAt: now },
    { roomId: "r-cseb", userId: "u-meera", role: "co_moderator", status: "approved", requestedAt: now },
    { roomId: "r-cseb", userId: "u-kabir", role: "member", status: "approved", requestedAt: now },
    { roomId: "r-cseb", userId: "u-riya", role: "member", status: "approved", requestedAt: now },
    { roomId: "r-cseb", userId: "u-isha", role: "member", status: "pending", requestedAt: now },
    ...FILLER.map((_, i) => ({ roomId: "r-cseb", userId: `u-f${i}`, role: "member" as Role, status: "approved" as MemberStatus, requestedAt: now })),
    { roomId: "r-hostel", userId: "u-meera", role: "moderator", status: "approved", requestedAt: now },
    { roomId: "r-hostel", userId: "u-riya", role: "member", status: "approved", requestedAt: now },
    { roomId: "r-hostel", userId: "u-f2", role: "member", status: "approved", requestedAt: now },
  ];

  const upi: StoredUpi[] = [
    { id: "upi-1", roomId: "r-cseb", upiId: "aarav.sharma@okaxis", payeeName: "Aarav Sharma", ownerUserId: "u-aarav", qrImageUrl: null, sortOrder: 0, active: true },
    { id: "upi-2", roomId: "r-cseb", upiId: "meera.nair@ybl", payeeName: "Meera Nair", ownerUserId: "u-meera", qrImageUrl: null, sortOrder: 1, active: true },
    { id: "upi-3", roomId: "r-hostel", upiId: "meera.nair@ybl", payeeName: "Meera Nair", ownerUserId: "u-meera", qrImageUrl: null, sortOrder: 0, active: true },
  ];

  // Riya's celebration already has 12 payers on the first UPI ID, 9 of them paid.
  const riyaCel = celebrationId("r-cseb", "u-riya", addDays(today, 1));
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

function currentUserId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(USER_KEY);
}

export function setDemoUser(id: DemoUserId | null) {
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

function notify(store: Store, userId: string, n: Omit<StoredNotification, "id" | "userId" | "createdAt" | "readAt">) {
  if (n.celebrationId && store.notifications.some((x) => x.userId === userId && x.celebrationId === n.celebrationId && x.kind === n.kind)) {
    return;
  }
  store.notifications.unshift({ ...n, id: uid("n"), userId, createdAt: new Date().toISOString(), readAt: null });
}

/** Celebrations in the next 7 days for a room (all of them, including the caller's own). */
function roomCelebrations(store: Store, roomId: string): Celebration[] {
  const today = todayIST();
  const limit = addDays(today, 7);
  return store.memberships
    .filter((m) => m.roomId === roomId && m.status === "approved")
    .flatMap((m) => {
      const p = store.profiles.find((x) => x.id === m.userId);
      if (!p) return [];
      const { month, day } = parseISODate(p.dob);
      const date = nextBirthday(month, day, today);
      if (date > limit) return [];
      return [{
        id: celebrationId(roomId, p.id, date),
        roomId,
        birthdayUserId: p.id,
        birthdayName: p.fullName,
        date,
        status: date === today ? "live" : "upcoming",
      } satisfies Celebration];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function findCelebration(store: Store, id: string): Celebration | null {
  const [, roomId] = id.split(".");
  return roomCelebrations(store, roomId).find((c) => c.id === id) ?? null;
}

/** What the cron job does, run on load so the demo always has reminders. */
function runReminders(store: Store) {
  const today = todayIST();
  for (const room of store.rooms) {
    for (const c of roomCelebrations(store, room.id)) {
      const first = c.birthdayName.split(" ")[0];
      let kind: NotificationKind | null = null;
      if (c.date === today && room.remindOnDay) kind = "on_day";
      else if (c.date === addDays(today, 1) && room.remindDayBefore) kind = "day_before";
      else if (c.date === addDays(today, 7) && room.remindWeekBefore) kind = "week_before";
      if (!kind) continue;
      const title = kind === "on_day" ? `Today is ${first}'s birthday!` : kind === "day_before" ? `Psst. ${first}'s birthday is tomorrow` : `${first}'s birthday is in a week`;
      const body = kind === "on_day" ? `Chip in and wish ${first} before class.` : kind === "day_before" ? `A gift is waiting for you to unwrap. Don't tell ${first}.` : `Start planning in ${room.name}. Don't tell ${first}.`;
      for (const m of store.memberships) {
        if (m.roomId !== room.id || m.status !== "approved" || m.userId === c.birthdayUserId) continue;
        notify(store, m.userId, { roomId: room.id, celebrationId: c.id, kind, title, body, url: `/rooms/${room.id}/surprise/${c.id}` });
      }
    }
  }
}

function toRoom(r: StoredRoom, m: StoredMembership): Room {
  const admin = m.status === "approved" && m.role !== "member";
  return {
    id: r.id, name: r.name, code: admin ? r.code : null, amountMode: r.amountMode, amount: r.amount,
    payersPerUpi: r.payersPerUpi, remindWeekBefore: r.remindWeekBefore, remindDayBefore: r.remindDayBefore,
    remindOnDay: r.remindOnDay, createdBy: r.createdBy, myRole: m.role, myStatus: m.status,
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
    if (existing) Object.assign(existing, { fullName: input.fullName.trim(), username: name, dob: input.dob });
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
      if (m.roomId === r.id && m.status === "approved" && m.role !== "member") {
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
    return delay(roomCelebrations(store, roomId).filter((c) => c.birthdayUserId !== me), 60);
  },

  async getCelebration(id) {
    const me = requireUser();
    const store = load();
    const c = findCelebration(store, id);
    if (!c || c.birthdayUserId === me || !isMember(store, c.roomId, me)) return null;
    return c;
  },

  async openSurprise(id): Promise<Surprise> {
    const me = requireUser();
    const store = load();
    const c = findCelebration(store, id);
    if (!c || c.birthdayUserId === me || !isMember(store, c.roomId, me)) throw new DataError("not_found");
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
          if (m.roomId === room.id && m.status === "approved" && m.role !== "member" && m.userId !== c.birthdayUserId) {
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
    }, 200);
  },

  async markPaid(id, paid, amount) {
    const me = requireUser();
    const store = load();
    const c = findCelebration(store, id);
    if (!c || c.birthdayUserId === me || !isMember(store, c.roomId, me)) throw new DataError("not_found");
    const room = store.rooms.find((r) => r.id === c.roomId)!;
    let mine = store.contributions.find((x) => x.celebrationId === id && x.userId === me);
    if (!mine) {
      mine = { celebrationId: id, userId: me, upiAccountId: null, amount: null, paidAt: null };
      store.contributions.push(mine);
    }
    mine.paidAt = paid ? mine.paidAt ?? new Date().toISOString() : null;
    if (room.amountMode !== "fixed" && amount != null) mine.amount = amount;
    persist(store);
  },

  async getPool(id): Promise<Pool> {
    const me = requireUser();
    const store = load();
    const c = findCelebration(store, id);
    if (!c || c.birthdayUserId === me || !isMember(store, c.roomId, me)) throw new DataError("not_found");
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
    if (!c || c.birthdayUserId === me || !isAdmin(store, c.roomId, me)) throw new DataError("not_found");
    return store.memberships
      .filter((m) => m.roomId === c.roomId && m.status === "approved" && m.userId !== c.birthdayUserId)
      .map((m) => {
        const p = store.profiles.find((x) => x.id === m.userId)!;
        const k = store.contributions.find((x) => x.celebrationId === id && x.userId === m.userId);
        return { userId: p.id, fullName: p.fullName, username: p.username, upiId: store.upi.find((u) => u.id === k?.upiAccountId)?.upiId ?? null, amount: k?.amount ?? null, paidAt: k?.paidAt ?? null };
      })
      .sort((a, b) => (a.paidAt ? 0 : 1) - (b.paidAt ? 0 : 1) || a.fullName.localeCompare(b.fullName));
  },

  onPoolChange(_id, cb) {
    return onChange(cb);
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
};

/** Lets pages re-render when the mock store changes (demo user switch etc.). */
export function onMockChange(cb: () => void): Unsubscribe {
  return onChange(cb);
}
