// Shared contracts between pages and the data layer.
// Changing these affects both people: announce changes before merging.

export type Role = "moderator" | "co_moderator" | "member";
export type MemberStatus = "pending" | "approved" | "declined";
export type AmountMode = "fixed" | "suggested" | "any";
export type CelebrationStatus = "upcoming" | "live" | "done";
/**
 * What the admins decided for a birthday.
 * - pending: not decided yet (treated like wish_only on the day)
 * - celebrate: secret reminders, surprise page and UPI collection
 * - wish_only: no collection; the room just wishes them on the day
 */
export type CelebrationDecision = "pending" | "celebrate" | "wish_only";
export type NotificationKind =
  | "week_before"
  | "day_before"
  | "on_day"
  | "join_request"
  | "join_approved"
  | "join_declined"
  | "upi_full"
  | "decision_needed"
  | "wish_reminder"
  | "birthday_wish";

/** The signed-in user's own profile. Only the owner ever sees `dob`. */
export interface Profile {
  id: string;
  fullName: string;
  username: string;
  /** ISO date YYYY-MM-DD, owner only. */
  dob: string;
  avatarUrl: string | null;
}

export interface Session {
  userId: string;
  email: string | null;
  /** Google display name, used to prefill onboarding. */
  suggestedName: string | null;
  /** null until onboarding is done. */
  profile: Profile | null;
}

export interface ProfileInput {
  fullName: string;
  username: string;
  dob: string;
}

export interface RoomPreview {
  roomId: string;
  name: string;
  memberCount: number;
  moderatorFirstName: string | null;
  /** The caller's existing membership, if any. */
  myStatus: MemberStatus | null;
}

export interface Room {
  id: string;
  name: string;
  /** Visible to admins only (null for members). */
  code: string | null;
  amountMode: AmountMode;
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
  myRole: Role;
  myStatus: MemberStatus;
}

export interface RoomSummary {
  id: string;
  name: string;
  myRole: Role;
  myStatus: MemberStatus;
}

/** Another person in a room. Birth year is never exposed. */
export interface Member {
  userId: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  birthMonth: number;
  birthDay: number;
  role: Role;
  status: MemberStatus;
  requestedAt: string;
}

export interface UpiAccount {
  id: string;
  upiId: string;
  payeeName: string;
  ownerUserId: string | null;
  qrImageUrl: string | null;
  sortOrder: number;
  active: boolean;
}

export interface UpiAccountInput {
  upiId: string;
  payeeName: string;
  ownerUserId: string | null;
  qrImageUrl: string | null;
}

export interface CreateRoomInput {
  name: string;
  amountMode: AmountMode;
  amount: number | null;
  payersPerUpi: number;
  remindWeekBefore: boolean;
  remindDayBefore: boolean;
  remindOnDay: boolean;
  /** Reminder times in India time, "HH:MM" (24-hour). */
  remindWeekBeforeAt: string;
  remindDayBeforeAt: string;
  remindOnDayAt: string;
  /** Send the birthday person a "happy birthday" from the room on the day. */
  sendBirthdayWish: boolean;
  /** New birthdays start as "celebrate" instead of waiting for an admin. */
  autoCelebrate: boolean;
  upiAccounts: UpiAccountInput[];
}

export type RoomSettingsInput = Omit<CreateRoomInput, "upiAccounts">;

/** A celebration as seen by anyone except its birthday person. */
export interface Celebration {
  id: string;
  roomId: string;
  birthdayUserId: string;
  birthdayName: string;
  /** ISO date YYYY-MM-DD in Asia/Kolkata. */
  date: string;
  status: CelebrationStatus;
  decision: CelebrationDecision;
}

/** What the surprise page shows after unwrapping. */
export interface Surprise {
  celebrationId: string;
  roomId: string;
  birthdayName: string;
  date: string;
  upi: {
    id: string;
    upiId: string;
    payeeName: string;
    qrImageUrl: string | null;
  } | null;
  amountMode: AmountMode;
  amount: number | null;
  allUpiFull: boolean;
  myPaidAt: string | null;
  myAmount: number | null;
}

export interface Pool {
  paidCount: number;
  eligibleCount: number;
  totalAmount: number;
}

/** Admins only. */
export interface Payer {
  userId: string;
  fullName: string;
  username: string;
  upiId: string | null;
  amount: number | null;
  paidAt: string | null;
}

export interface AppNotification {
  id: string;
  roomId: string | null;
  celebrationId: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  readAt: string | null;
}

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

/** Error codes the data layer throws (DataError.code). */
export type DataErrorCode =
  | "not_signed_in"
  | "profile_missing"
  | "room_not_found"
  | "not_allowed"
  | "not_found"
  | "username_taken"
  | "invalid_input"
  | "unknown";

export class DataError extends Error {
  constructor(
    public code: DataErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "DataError";
  }
}
