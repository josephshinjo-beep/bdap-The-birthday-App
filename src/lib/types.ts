// Shared contracts between pages and the data layer.
// Changing these affects both people: announce changes before merging.

/** class_rep: can request expense splits and record who paid (not an admin). */
export type Role = "moderator" | "co_moderator" | "class_rep" | "member";

/** Moderators and co-moderators run the room. */
export function isAdminRole(role: Role | null | undefined): boolean {
  return role === "moderator" || role === "co_moderator";
}

/** Admins plus class reps: can request splits and record payments. */
export function isRepRole(role: Role | null | undefined): boolean {
  return isAdminRole(role) || role === "class_rep";
}
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
  | "birthday_wish"
  | "expense_request"
  | "expense_approved"
  | "poll_open"
  | "wall_ready";

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
  /** An admin set this member's birthday for this room (it differs from their profile). */
  birthdayEdited: boolean;
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
  /** What the money is for, e.g. "Cake 🎂". */
  purpose: string | null;
  /** Total cost in rupees; split equally between everyone except the birthday person. */
  totalExpense: number | null;
  /** The plan for the day, e.g. "Cake cutting at 4:30 PM in the CSE lab". */
  plan: string | null;
  /** ceil(totalExpense / payers). Nobody can chip in less than this. */
  splitAmount: number | null;
}

export interface CelebrationDetailsInput {
  purpose: string | null;
  totalExpense: number | null;
  plan: string | null;
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
  purpose: string | null;
  plan: string | null;
  totalExpense: number | null;
  /** Minimum (and suggested) amount when a total expense is set. */
  splitAmount: number | null;
}

export interface Pool {
  paidCount: number;
  eligibleCount: number;
  totalAmount: number;
}

/** Admins and class reps only. */
export interface Payer {
  userId: string;
  fullName: string;
  username: string;
  upiId: string | null;
  amount: number | null;
  paidAt: string | null;
  /** Set when a class rep or admin recorded the payment (e.g. cash). */
  recordedBy: string | null;
}

/** A vote, e.g. on the cake flavour. Closing it sets the celebration's total to the winner's price. */
export interface Poll {
  id: string;
  roomId: string;
  celebrationId: string | null;
  question: string;
  status: "open" | "closed";
  winnerOptionId: string | null;
  options: PollOption[];
  myVote: string | null;
  totalVotes: number;
}

export interface PollOption {
  id: string;
  label: string;
  price: number | null;
  votes: number;
}

export interface PollOptionInput {
  label: string;
  price: number | null;
}

export type ExpenseStatus = "requested" | "approved" | "declined" | "closed";

/** A class expense split equally between members (trip, printouts, a gift…). */
export interface Expense {
  id: string;
  roomId: string;
  title: string;
  purpose: string | null;
  totalAmount: number;
  /** Per person; set when a moderator approves. */
  splitAmount: number | null;
  upi: { id: string; upiId: string; payeeName: string; qrImageUrl: string | null } | null;
  dueDate: string | null;
  status: ExpenseStatus;
  createdById: string | null;
  createdByName: string | null;
  paidCount: number;
  eligibleCount: number;
  collected: number;
  myPaidAt: string | null;
  myAmount: number | null;
}

export interface ExpenseInput {
  title: string;
  purpose: string | null;
  totalAmount: number;
  upiAccountId: string | null;
  dueDate: string | null;
}

export type WishColor = "sun" | "pink" | "mint" | "sky" | "white";

/** A note on the birthday wall. Position is a percentage of the wall. */
export interface Wish {
  id: string;
  celebrationId: string;
  authorId: string;
  authorName: string;
  message: string;
  /** Only the birthday person (and the author) can read it. */
  isPrivate: boolean;
  color: WishColor;
  x: number;
  y: number;
  rotation: number;
  createdAt: string;
  mine: boolean;
}

export interface WishInput {
  message: string;
  isPrivate: boolean;
  color: WishColor;
}

export interface WallInfo {
  celebrationId: string;
  roomId: string;
  roomName: string;
  birthdayName: string;
  date: string;
  /** The birthday has arrived (the birthday person can see the wall). */
  revealed: boolean;
  isBirthdayPerson: boolean;
  plan: string | null;
  wishCount: number;
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
  /** Birthday reminders and approvals: shown first and pushed as high priority. */
  priority: boolean;
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
