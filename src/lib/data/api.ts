// The data layer contract. Pages only talk to this interface, so they work the
// same against the in-memory mock and the real Supabase backend.
import type {
  AppNotification,
  Celebration,
  CelebrationDecision,
  CreateRoomInput,
  Member,
  MemberStatus,
  Payer,
  Pool,
  ProfileInput,
  PushSubscriptionInput,
  Role,
  Room,
  RoomPreview,
  RoomSettingsInput,
  RoomSummary,
  Session,
  Surprise,
  UpiAccount,
  UpiAccountInput,
} from "@/lib/types";

export type DataMode = "mock" | "supabase";
export type Unsubscribe = () => void;

export interface DataApi {
  readonly mode: DataMode;

  // auth + profile
  getSession(): Promise<Session | null>;
  /** Starts Google sign-in. `next` is the path to return to. */
  signInWithGoogle(next?: string): Promise<void>;
  signOut(): Promise<void>;
  usernameAvailable(username: string): Promise<boolean>;
  saveProfile(input: ProfileInput): Promise<void>;

  // rooms and enrolment
  previewRoom(code: string): Promise<RoomPreview | null>;
  requestJoin(code: string): Promise<{ roomId: string; status: MemberStatus }>;
  myRooms(): Promise<RoomSummary[]>;
  getRoom(roomId: string): Promise<Room | null>;
  createRoom(input: CreateRoomInput): Promise<{ roomId: string; code: string }>;
  updateRoom(roomId: string, input: RoomSettingsInput): Promise<void>;
  regenerateCode(roomId: string): Promise<string>;
  leaveRoom(roomId: string): Promise<void>;
  /** Moderator only. Deletes the room, its members, celebrations and UPI IDs. */
  deleteRoom(roomId: string): Promise<void>;

  // members (admins see pending too)
  listMembers(roomId: string): Promise<Member[]>;
  decideRequest(roomId: string, userId: string, approve: boolean): Promise<void>;
  setMemberRole(roomId: string, userId: string, role: Exclude<Role, "moderator">): Promise<void>;
  removeMember(roomId: string, userId: string): Promise<void>;
  /** Fires when the caller's membership in this room changes (approval). */
  onMembershipChange(roomId: string, cb: (status: MemberStatus) => void): Unsubscribe;

  // UPI accounts (admins)
  listUpiAccounts(roomId: string): Promise<UpiAccount[]>;
  addUpiAccount(roomId: string, input: UpiAccountInput): Promise<void>;
  updateUpiAccount(roomId: string, accountId: string, patch: Partial<UpiAccountInput> & { active?: boolean; sortOrder?: number }): Promise<void>;
  deleteUpiAccount(roomId: string, accountId: string): Promise<void>;
  uploadQrImage(roomId: string, file: File): Promise<string>;

  // celebrations (never returns the caller's own)
  /** Approved celebrations in the next 7 days (what members see). */
  upcomingCelebrations(roomId: string): Promise<Celebration[]>;
  /** Admins: every birthday in the next 30 days with its decision. */
  adminCelebrations(roomId: string): Promise<Celebration[]>;
  setCelebrationDecision(celebrationId: string, decision: CelebrationDecision): Promise<void>;
  getCelebration(celebrationId: string): Promise<Celebration | null>;
  openSurprise(celebrationId: string): Promise<Surprise>;
  markPaid(celebrationId: string, paid: boolean, amount?: number | null): Promise<void>;
  getPool(celebrationId: string): Promise<Pool>;
  getPayers(celebrationId: string): Promise<Payer[]>;
  onPoolChange(celebrationId: string, cb: () => void): Unsubscribe;

  // notifications
  listNotifications(): Promise<AppNotification[]>;
  markNotificationsRead(ids?: string[]): Promise<void>;
  onNotification(cb: (n: AppNotification) => void): Unsubscribe;
  savePushSubscription(sub: PushSubscriptionInput): Promise<void>;
  deletePushSubscription(endpoint: string): Promise<void>;
}
