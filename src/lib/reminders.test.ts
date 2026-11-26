import { describe, expect, it } from "vitest";
import { formatTime, timeIST } from "./dates";
import { dueReminders, type ReminderSettings } from "./reminders";

const settings: ReminderSettings = {
  remindWeekBefore: true,
  remindDayBefore: true,
  remindOnDay: true,
  remindWeekBeforeAt: "18:00",
  remindDayBeforeAt: "20:30",
  remindOnDayAt: "07:30",
  sendBirthdayWish: true,
};
const today = "2026-11-26";

describe("dueReminders", () => {
  it("sends nothing to members until an admin approves", () => {
    const r = dueReminders({ settings, decision: "pending", date: "2026-11-27", today, time: "21:00" });
    expect(r.toMembers).toEqual([]);
    expect(r.toAdmins).toEqual(["decision_needed"]);
  });

  it("waits for the room's custom day-before time", () => {
    expect(dueReminders({ settings, decision: "celebrate", date: "2026-11-27", today, time: "20:29" }).toMembers).toEqual([]);
    expect(dueReminders({ settings, decision: "celebrate", date: "2026-11-27", today, time: "20:30" }).toMembers).toEqual(["day_before"]);
  });

  it("sends the week-before reminder only when switched on", () => {
    const on = dueReminders({ settings, decision: "celebrate", date: "2026-12-03", today, time: "18:00" });
    const off = dueReminders({ settings: { ...settings, remindWeekBefore: false }, decision: "celebrate", date: "2026-12-03", today, time: "18:00" });
    expect(on.toMembers).toEqual(["week_before"]);
    expect(off.toMembers).toEqual([]);
  });

  it("on the day: celebrate sends the surprise reminder, otherwise a wish nudge", () => {
    expect(dueReminders({ settings, decision: "celebrate", date: today, today, time: "08:00" }).toMembers).toEqual(["on_day"]);
    expect(dueReminders({ settings, decision: "wish_only", date: today, today, time: "08:00" }).toMembers).toEqual(["wish_reminder"]);
    expect(dueReminders({ settings, decision: "pending", date: today, today, time: "08:00" }).toMembers).toEqual(["wish_reminder"]);
  });

  it("wishes the birthday person on the day if the room allows it", () => {
    expect(dueReminders({ settings, decision: "wish_only", date: today, today, time: "07:30" }).toBirthdayPerson).toEqual(["birthday_wish"]);
    expect(dueReminders({ settings: { ...settings, sendBirthdayWish: false }, decision: "wish_only", date: today, today, time: "09:00" }).toBirthdayPerson).toEqual([]);
    expect(dueReminders({ settings, decision: "celebrate", date: today, today, time: "07:29" }).toBirthdayPerson).toEqual([]);
  });

  it("stops asking admins once decided, and ignores past birthdays", () => {
    expect(dueReminders({ settings, decision: "wish_only", date: "2026-12-10", today, time: "10:00" }).toAdmins).toEqual([]);
    expect(dueReminders({ settings, decision: "pending", date: "2026-11-20", today, time: "10:00" })).toEqual({ toMembers: [], toBirthdayPerson: [], toAdmins: [] });
  });
});

describe("time helpers", () => {
  it("reads India time", () => {
    expect(timeIST(new Date("2026-11-26T12:30:00Z"))).toBe("18:00");
  });
  it("formats 24-hour times", () => {
    expect(formatTime("18:00")).toBe("6:00 PM");
    expect(formatTime("07:30")).toBe("7:30 AM");
    expect(formatTime("00:15")).toBe("12:15 AM");
  });
});
