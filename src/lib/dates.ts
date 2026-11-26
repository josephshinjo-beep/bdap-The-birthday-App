// Date helpers. Every birthday date in bdap is a calendar date in Asia/Kolkata,
// written as an ISO string YYYY-MM-DD. Mirrors birthday_in_year / next_birthday in SQL.

export const TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toISODate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseISODate(iso: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Bad ISO date: ${iso}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** Today's date in India, whatever the device's time zone. */
export function todayIST(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The date a birthday is celebrated in a given year (29 Feb → 28 Feb in non-leap years). */
export function birthdayInYear(month: number, day: number, year: number): string {
  if (month === 2 && day === 29 && !isLeapYear(year)) return toISODate(year, 2, 28);
  return toISODate(year, month, day);
}

/** The next celebration date on or after `fromISO`. */
export function nextBirthday(month: number, day: number, fromISO: string): string {
  const { year } = parseISODate(fromISO);
  const thisYear = birthdayInYear(month, day, year);
  return thisYear >= fromISO ? thisYear : birthdayInYear(month, day, year + 1);
}

export function addDays(iso: string, days: number): string {
  const { year, month, day } = parseISODate(iso);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return toISODate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Whole days from a to b (b - a). */
export function daysBetween(aISO: string, bISO: string): number {
  const a = parseISODate(aISO);
  const b = parseISODate(bISO);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000,
  );
}

/** The current time of day in India, "HH:MM" (24-hour). */
export function timeIST(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("hour")}:${get("minute")}`;
}

/** "18:00" → "6:00 PM". */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h! >= 12 ? "PM" : "AM";
  const hour = h! % 12 === 0 ? 12 : h! % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Midnight IST at the start of the given date, as an instant. */
export function startOfDayIST(iso: string): Date {
  return new Date(`${iso}T00:00:00${IST_OFFSET}`);
}

/** "14 Mar" — never shows a year. */
export function formatDayMonth(month: number, day: number): string {
  return `${day} ${MONTHS[month - 1]}`;
}

export function formatISODayMonth(iso: string): string {
  const { month, day } = parseISODate(iso);
  return formatDayMonth(month, day);
}

/** "today", "tomorrow", "in 5 days". */
export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} ago`;
  return `in ${days} days`;
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

export function countdownTo(target: Date, now: Date = new Date()): Countdown {
  const ms = Math.max(0, target.getTime() - now.getTime());
  const s = Math.floor(ms / 1000);
  return {
    days: Math.floor(s / 86_400),
    hours: Math.floor((s % 86_400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    done: ms === 0,
  };
}
