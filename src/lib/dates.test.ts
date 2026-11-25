import { describe, expect, it } from "vitest";
import {
  addDays,
  birthdayInYear,
  countdownTo,
  daysBetween,
  formatDayMonth,
  isLeapYear,
  nextBirthday,
  startOfDayIST,
  todayIST,
} from "./dates";

describe("isLeapYear", () => {
  it("handles century rules", () => {
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });
});

describe("birthdayInYear", () => {
  it("celebrates 29 Feb on 28 Feb in non-leap years", () => {
    expect(birthdayInYear(2, 29, 2027)).toBe("2027-02-28");
    expect(birthdayInYear(2, 29, 2028)).toBe("2028-02-29");
  });
  it("keeps ordinary dates", () => {
    expect(birthdayInYear(11, 26, 2026)).toBe("2026-11-26");
  });
});

describe("nextBirthday", () => {
  it("returns today when the birthday is today", () => {
    expect(nextBirthday(11, 25, "2026-11-25")).toBe("2026-11-25");
  });
  it("rolls over to next year once passed", () => {
    expect(nextBirthday(1, 5, "2026-11-25")).toBe("2027-01-05");
  });
  it("applies the 29 Feb rule across years", () => {
    expect(nextBirthday(2, 29, "2026-11-25")).toBe("2027-02-28");
    expect(nextBirthday(2, 29, "2027-03-01")).toBe("2028-02-29");
  });
});

describe("todayIST", () => {
  it("uses India time, not UTC", () => {
    // 20:00 UTC on 25 Nov is 01:30 IST on 26 Nov
    expect(todayIST(new Date("2026-11-25T20:00:00Z"))).toBe("2026-11-26");
    expect(todayIST(new Date("2026-11-25T18:00:00Z"))).toBe("2026-11-25");
  });
});

describe("date arithmetic", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("counts days between dates", () => {
    expect(daysBetween("2026-11-25", "2026-12-02")).toBe(7);
    expect(daysBetween("2026-11-25", "2026-11-25")).toBe(0);
  });
  it("starts the day at IST midnight", () => {
    expect(startOfDayIST("2026-11-26").toISOString()).toBe("2026-11-25T18:30:00.000Z");
  });
  it("counts down", () => {
    const c = countdownTo(new Date("2026-11-26T00:00:00Z"), new Date("2026-11-24T22:58:57Z"));
    expect(c).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 3, done: false });
    expect(countdownTo(new Date(0)).done).toBe(true);
  });
  it("never prints a year", () => {
    expect(formatDayMonth(3, 14)).toBe("14 Mar");
  });
});
