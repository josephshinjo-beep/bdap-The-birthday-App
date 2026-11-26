// Which notifications are due for a birthday right now.
// Mirrors prepare_due_reminders() in supabase/migrations (keep them in sync).
// The job runs every 15 minutes; a notification is "due" once its day has
// come and the room's chosen time has passed. Sending is idempotent, so a
// later run on the same day never sends it twice.

import { daysBetween } from "./dates";
import type { CelebrationDecision, NotificationKind } from "./types";

/** Admins are asked to decide this many days ahead. */
export const DECISION_WINDOW_DAYS = 30;

export interface ReminderSettings {
  remindWeekBefore: boolean;
  remindDayBefore: boolean;
  remindOnDay: boolean;
  /** "HH:MM" in India time. */
  remindWeekBeforeAt: string;
  remindDayBeforeAt: string;
  remindOnDayAt: string;
  sendBirthdayWish: boolean;
}

export interface DueReminders {
  /** Sent to every approved member except the birthday person. */
  toMembers: NotificationKind[];
  /** Sent to the birthday person. */
  toBirthdayPerson: NotificationKind[];
  /** Sent to moderators and co-moderators (never the birthday person). */
  toAdmins: NotificationKind[];
}

export function dueReminders(args: {
  settings: ReminderSettings;
  decision: CelebrationDecision;
  /** Celebration date, YYYY-MM-DD (IST). */
  date: string;
  /** Today, YYYY-MM-DD (IST). */
  today: string;
  /** Now, "HH:MM" (IST). */
  time: string;
}): DueReminders {
  const { settings: s, decision, date, today, time } = args;
  const days = daysBetween(today, date);
  const due: DueReminders = { toMembers: [], toBirthdayPerson: [], toAdmins: [] };
  if (days < 0) return due;

  // Ask the admins as soon as a birthday enters the decision window.
  if (decision === "pending" && days <= DECISION_WINDOW_DAYS) due.toAdmins.push("decision_needed");

  if (decision === "celebrate") {
    // The secret plan: reminders lead to the surprise page and UPI collection.
    if (days === 7 && s.remindWeekBefore && time >= s.remindWeekBeforeAt) due.toMembers.push("week_before");
    if (days === 1 && s.remindDayBefore && time >= s.remindDayBeforeAt) due.toMembers.push("day_before");
    if (days === 0 && s.remindOnDay && time >= s.remindOnDayAt) due.toMembers.push("on_day");
  } else if (days === 0 && s.remindOnDay && time >= s.remindOnDayAt) {
    // Not approved (or not decided): no collection, just a nudge to wish them.
    due.toMembers.push("wish_reminder");
  }

  if (days === 0 && s.sendBirthdayWish && time >= s.remindOnDayAt) due.toBirthdayPerson.push("birthday_wish");
  return due;
}

/** Notification text for each kind. */
export function reminderText(kind: NotificationKind, first: string, roomName: string): { title: string; body: string } {
  switch (kind) {
    case "week_before":
      return { title: `${first}'s birthday is in a week`, body: `Start planning in ${roomName}. Don't tell ${first}.` };
    case "day_before":
      return { title: `Psst. ${first}'s birthday is tomorrow`, body: `A gift is waiting for you to unwrap. Don't tell ${first}.` };
    case "on_day":
      return { title: `Today is ${first}'s birthday!`, body: `Chip in and wish ${first} before class.` };
    case "wish_reminder":
      return { title: `It's ${first}'s birthday today 🎂`, body: `Send ${first} a wish. No collection this time.` };
    case "birthday_wish":
      return { title: `Happy birthday, ${first}! 🎉`, body: `Everyone in ${roomName} is wishing you a wonderful day.` };
    case "decision_needed":
      return { title: `Celebrate ${first}'s birthday?`, body: `Choose "Celebrate" or "Just wish" in ${roomName}. Nothing goes out until you decide.` };
    default:
      return { title: "bdap", body: "" };
  }
}
