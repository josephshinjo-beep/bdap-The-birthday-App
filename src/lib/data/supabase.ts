"use client";
// Real data layer: Supabase with RLS. Cross-user reads and writes go through
// the SECURITY DEFINER RPCs in supabase/migrations. Backend-owned file.

import { getBrowserSupabase } from "@/lib/supabase/client";
import {
  DataError,
  type AppNotification,
  type Celebration,
  type DataErrorCode,
  type Member,
  type MemberStatus,
  type Payer,
  type Pool,
  type Room,
  type RoomSummary,
  type Session,
  type Surprise,
  type UpiAccount,
} from "@/lib/types";
import type { DataApi } from "./api";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const KNOWN: DataErrorCode[] = ["not_signed_in", "profile_missing", "room_not_found", "not_allowed", "not_found", "username_taken", "invalid_input"];

function fail(error: { message?: string; code?: string } | null): never {
  const msg = error?.message ?? "unknown";
  const code = KNOWN.find((k) => msg.includes(k));
  if (code) throw new DataError(code, msg);
  if (error?.code === "23505") throw new DataError("username_taken", msg);
  if (error?.code === "23514") throw new DataError("invalid_input", msg);
  throw new DataError("unknown", msg);
}

const sb = () => getBrowserSupabase();

async function uid(): Promise<string> {
  const { data } = await sb().auth.getUser();
  if (!data.user) throw new DataError("not_signed_in");
  return data.user.id;
}

function toMember(r: Row): Member {
  return {
    userId: r.user_id, fullName: r.full_name, username: r.username, avatarUrl: r.avatar_url,
    birthMonth: r.birth_month, birthDay: r.birth_day, role: r.role, status: r.status, requestedAt: r.requested_at,
  };
}

function toUpi(r: Row): UpiAccount {
  return { id: r.id, upiId: r.upi_id, payeeName: r.payee_name, ownerUserId: r.owner_user_id, qrImageUrl: r.qr_image_url, sortOrder: r.sort_order, active: r.active };
}

function toNotification(r: Row): AppNotification {
  return { id: r.id, roomId: r.room_id, celebrationId: r.celebration_id, kind: r.kind, title: r.title, body: r.body, url: r.url, createdAt: r.created_at, readAt: r.read_at };
}

async function memberNames(roomId: string): Promise<Map<string, string>> {
  const { data, error } = await sb().rpc("room_members", { p_room: roomId });
  if (error) fail(error);
  return new Map((data as Row[]).map((m) => [m.user_id as string, m.full_name as string]));
}

function toCelebration(r: Row, names: Map<string, string>): Celebration {
  return { id: r.id, roomId: r.room_id, birthdayUserId: r.birthday_user_id, birthdayName: names.get(r.birthday_user_id) ?? "A classmate", date: r.celebration_date, status: r.status };
}

let channelSeq = 0;

export const supabaseApi: DataApi = {
  mode: "supabase",

  async getSession(): Promise<Session | null> {
    const { data } = await sb().auth.getUser();
    const user = data.user;
    if (!user) return null;
    const { data: p } = await sb().from("profiles").select("id, full_name, username, dob, avatar_url").eq("id", user.id).maybeSingle();
    const meta = user.user_metadata ?? {};
    return {
      userId: user.id,
      email: user.email ?? null,
      suggestedName: (meta.full_name as string) ?? (meta.name as string) ?? null,
      profile: p ? { id: p.id, fullName: p.full_name, username: p.username, dob: p.dob, avatarUrl: p.avatar_url ?? (meta.avatar_url as string) ?? null } : null,
    };
  },

  async signInWithGoogle(next = "/") {
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await sb().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) fail(error);
  },

  async signOut() {
    await sb().auth.signOut();
  },

  async usernameAvailable(username) {
    const { data, error } = await sb().rpc("username_available", { p_username: username });
    if (error) fail(error);
    return Boolean(data);
  },

  async saveProfile(input) {
    const id = await uid();
    const { data: { user } } = await sb().auth.getUser();
    const { error } = await sb().from("profiles").upsert({
      id, full_name: input.fullName.trim(), username: input.username.toLowerCase(), dob: input.dob,
      avatar_url: (user?.user_metadata?.avatar_url as string) ?? null,
    });
    if (error) fail(error);
  },

  async previewRoom(code) {
    const { data, error } = await sb().rpc("preview_room", { p_code: code });
    if (error) fail(error);
    const r = (data as Row[])[0];
    if (!r) return null;
    return { roomId: r.room_id, name: r.name, memberCount: r.member_count, moderatorFirstName: r.moderator_name, myStatus: r.my_status };
  },

  async requestJoin(code) {
    const { data, error } = await sb().rpc("request_join", { p_code: code });
    if (error) fail(error);
    const r = (data as Row[])[0];
    return { roomId: r.room_id as string, status: r.status as MemberStatus };
  },

  async myRooms(): Promise<RoomSummary[]> {
    const me = await uid();
    const { data, error } = await sb().from("memberships").select("role, status, rooms(id, name)").eq("user_id", me).neq("status", "declined");
    if (error) fail(error);
    return (data as Row[]).filter((m) => m.rooms).map((m) => ({ id: m.rooms.id, name: m.rooms.name, myRole: m.role, myStatus: m.status }));
  },

  async getRoom(roomId): Promise<Room | null> {
    const me = await uid();
    const [{ data: r }, { data: m }] = await Promise.all([
      sb().from("rooms").select("*").eq("id", roomId).maybeSingle(),
      sb().from("memberships").select("role, status").eq("room_id", roomId).eq("user_id", me).maybeSingle(),
    ]);
    if (!r || !m) return null;
    const admin = m.status === "approved" && m.role !== "member";
    return {
      id: r.id, name: r.name, code: admin ? r.code : null, amountMode: r.amount_mode, amount: r.amount,
      payersPerUpi: r.payers_per_upi, remindWeekBefore: r.remind_week_before, remindDayBefore: r.remind_day_before,
      remindOnDay: r.remind_on_day, createdBy: r.created_by, myRole: m.role, myStatus: m.status,
    };
  },

  async createRoom(input) {
    const { data, error } = await sb().rpc("create_room", {
      p_name: input.name,
      p_amount_mode: input.amountMode,
      p_amount: input.amount,
      p_payers_per_upi: input.payersPerUpi,
      p_remind_week_before: input.remindWeekBefore,
      p_remind_day_before: input.remindDayBefore,
      p_remind_on_day: input.remindOnDay,
      p_upi_accounts: input.upiAccounts.map((a) => ({ upi_id: a.upiId, payee_name: a.payeeName, owner_user_id: a.ownerUserId ?? "", qr_image_url: a.qrImageUrl ?? "" })),
    });
    if (error) fail(error);
    const roomId = data as string;
    const { data: r } = await sb().from("rooms").select("code").eq("id", roomId).single();
    return { roomId, code: r?.code as string };
  },

  async updateRoom(roomId, input) {
    const { error } = await sb().from("rooms").update({
      name: input.name.trim(), amount_mode: input.amountMode, amount: input.amountMode === "any" ? null : input.amount,
      payers_per_upi: input.payersPerUpi, remind_week_before: input.remindWeekBefore,
      remind_day_before: input.remindDayBefore, remind_on_day: input.remindOnDay,
    }).eq("id", roomId);
    if (error) fail(error);
  },

  async regenerateCode(roomId) {
    const { data, error } = await sb().rpc("regenerate_room_code", { p_room: roomId });
    if (error) fail(error);
    return data as string;
  },

  async leaveRoom(roomId) {
    const me = await uid();
    const { error } = await sb().from("memberships").delete().eq("room_id", roomId).eq("user_id", me);
    if (error) fail(error);
  },

  async listMembers(roomId) {
    const { data, error } = await sb().rpc("room_members", { p_room: roomId });
    if (error) fail(error);
    return (data as Row[]).map(toMember);
  },

  async decideRequest(roomId, userId, approve) {
    const { error } = await sb().rpc("decide_request", { p_room: roomId, p_user: userId, p_approve: approve });
    if (error) fail(error);
  },

  async setMemberRole(roomId, userId, role) {
    const { error } = await sb().rpc("set_member_role", { p_room: roomId, p_user: userId, p_role: role });
    if (error) fail(error);
  },

  async removeMember(roomId, userId) {
    const { error } = await sb().rpc("remove_member", { p_room: roomId, p_user: userId });
    if (error) fail(error);
  },

  onMembershipChange(roomId, cb) {
    let channel: ReturnType<ReturnType<typeof sb>["channel"]> | null = null;
    let closed = false;
    void uid().then((me) => {
      if (closed) return;
      channel = sb()
        .channel(`membership-${roomId}-${++channelSeq}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "memberships", filter: `user_id=eq.${me}` }, (payload) => {
          const row = payload.new as Row;
          if (row?.room_id === roomId && row.status) cb(row.status as MemberStatus);
        })
        .subscribe();
    });
    // Realtime can miss events on flaky mobile networks: poll as a backstop.
    const timer = setInterval(async () => {
      const me = await uid().catch(() => null);
      if (!me) return;
      const { data } = await sb().from("memberships").select("status").eq("room_id", roomId).eq("user_id", me).maybeSingle();
      if (data?.status) cb(data.status as MemberStatus);
    }, 15_000);
    return () => {
      closed = true;
      clearInterval(timer);
      if (channel) void sb().removeChannel(channel);
    };
  },

  async listUpiAccounts(roomId) {
    const { data, error } = await sb().from("room_upi_accounts").select("*").eq("room_id", roomId).order("sort_order");
    if (error) fail(error);
    return (data as Row[]).map(toUpi);
  },

  async addUpiAccount(roomId, input) {
    const { data: existing } = await sb().from("room_upi_accounts").select("sort_order").eq("room_id", roomId).order("sort_order", { ascending: false }).limit(1);
    const order = ((existing?.[0]?.sort_order as number | undefined) ?? -1) + 1;
    const { error } = await sb().from("room_upi_accounts").insert({
      room_id: roomId, upi_id: input.upiId.trim(), payee_name: input.payeeName.trim(),
      owner_user_id: input.ownerUserId, qr_image_url: input.qrImageUrl, sort_order: order,
    });
    if (error) fail(error);
  },

  async updateUpiAccount(roomId, accountId, patch) {
    const row: Row = {};
    if (patch.upiId !== undefined) row.upi_id = patch.upiId.trim();
    if (patch.payeeName !== undefined) row.payee_name = patch.payeeName.trim();
    if (patch.ownerUserId !== undefined) row.owner_user_id = patch.ownerUserId;
    if (patch.qrImageUrl !== undefined) row.qr_image_url = patch.qrImageUrl;
    if (patch.active !== undefined) row.active = patch.active;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    const { error } = await sb().from("room_upi_accounts").update(row).eq("id", accountId).eq("room_id", roomId);
    if (error) fail(error);
  },

  async uploadQrImage(roomId, file) {
    const me = await uid();
    const ext = (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${me}/${roomId}-${Date.now()}.${ext}`;
    const { error } = await sb().storage.from("upi-qr").upload(path, file, { contentType: file.type, upsert: false });
    if (error) fail(error);
    return sb().storage.from("upi-qr").getPublicUrl(path).data.publicUrl;
  },

  async upcomingCelebrations(roomId) {
    // Make sure birthdays in the next week have a celebration row even before the cron runs.
    await sb().rpc("ensure_room_celebrations", { p_room: roomId });
    const [{ data, error }, names] = await Promise.all([
      sb().from("celebrations").select("*").eq("room_id", roomId).in("status", ["upcoming", "live"]).order("celebration_date"),
      memberNames(roomId),
    ]);
    if (error) fail(error);
    return (data as Row[]).map((r) => toCelebration(r, names));
  },

  async getCelebration(id) {
    const { data } = await sb().from("celebrations").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    return toCelebration(data, await memberNames(data.room_id));
  },

  async openSurprise(id): Promise<Surprise> {
    const { data, error } = await sb().rpc("open_surprise", { p_celebration: id });
    if (error) fail(error);
    const r = (data as Row[])[0];
    if (!r) throw new DataError("not_found");
    return {
      celebrationId: r.celebration_id, roomId: r.room_id, birthdayName: r.birthday_name, date: r.celebration_date,
      upi: r.upi_account_id ? { id: r.upi_account_id, upiId: r.upi_id, payeeName: r.payee_name, qrImageUrl: r.qr_image_url } : null,
      amountMode: r.amount_mode, amount: r.amount, allUpiFull: r.all_upi_full, myPaidAt: r.my_paid_at, myAmount: r.my_amount,
    };
  },

  async markPaid(id, paid, amount) {
    const { error } = await sb().rpc("mark_paid", { p_celebration: id, p_paid: paid, p_amount: amount ?? null });
    if (error) fail(error);
  },

  async getPool(id): Promise<Pool> {
    const { data, error } = await sb().rpc("celebration_pool", { p_celebration: id });
    if (error) fail(error);
    const r = (data as Row[])[0] ?? { paid_count: 0, eligible_count: 0, total_amount: 0 };
    return { paidCount: r.paid_count, eligibleCount: r.eligible_count, totalAmount: r.total_amount };
  },

  async getPayers(id): Promise<Payer[]> {
    const { data, error } = await sb().rpc("celebration_payers", { p_celebration: id });
    if (error) fail(error);
    return (data as Row[]).map((r) => ({ userId: r.user_id, fullName: r.full_name, username: r.username, upiId: r.upi_id, amount: r.amount, paidAt: r.marked_paid_at }));
  },

  onPoolChange(_id, cb) {
    // Other people's contributions are hidden by RLS, so poll the pool RPC.
    const timer = setInterval(cb, 10_000);
    return () => clearInterval(timer);
  },

  async listNotifications() {
    const { data, error } = await sb().from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) fail(error);
    return (data as Row[]).map(toNotification);
  },

  async markNotificationsRead(ids) {
    const me = await uid();
    let q = sb().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", me).is("read_at", null);
    if (ids) q = q.in("id", ids);
    const { error } = await q;
    if (error) fail(error);
  },

  onNotification(cb) {
    let channel: ReturnType<ReturnType<typeof sb>["channel"]> | null = null;
    let closed = false;
    void uid().then((me) => {
      if (closed) return;
      channel = sb()
        .channel(`notifications-${++channelSeq}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me}` }, (payload) => cb(toNotification(payload.new as Row)))
        .subscribe();
    }).catch(() => {});
    return () => {
      closed = true;
      if (channel) void sb().removeChannel(channel);
    };
  },

  async savePushSubscription(sub) {
    const res = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
    if (!res.ok) throw new DataError("unknown", "Could not save the push subscription.");
  },

  async deletePushSubscription(endpoint) {
    await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint }) });
  },
};
