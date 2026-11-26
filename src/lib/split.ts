// Money and voting rules shared by the UI, the demo data and (mirrored) the SQL.

import type { NotificationKind } from "./types";

/** Equal share per person, rounded up so the total is always covered. */
export function splitAmount(total: number | null | undefined, payers: number): number | null {
  if (total == null || total <= 0) return null;
  return Math.ceil(total / Math.max(1, payers));
}

/** Nobody can chip in less than their share. Returns an error message, or null if fine. */
export function checkContribution(amount: number | null | undefined, split: number | null): string | null {
  if (split == null) return null;
  if (amount == null || !Number.isFinite(amount)) return `Enter at least ₹${split}.`;
  if (amount < split) return `Your share is ₹${split}. You can give more, but not less.`;
  return null;
}

export interface VoteOption {
  id: string;
  price: number | null;
  votes: number;
  sortOrder: number;
}

/** Most votes wins; a tie goes to the cheaper option, then the one listed first. */
export function pickWinner(options: VoteOption[]): string | null {
  if (options.length === 0) return null;
  const sorted = [...options].sort(
    (a, b) => b.votes - a.votes || (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER) || a.sortOrder - b.sortOrder,
  );
  return sorted[0]!.id;
}

/** Notifications that are pushed as high priority and pinned first in the bell. */
export const PRIORITY_KINDS: NotificationKind[] = ["week_before", "day_before", "on_day", "birthday_wish", "wall_ready", "expense_approved"];

export function isPriority(kind: NotificationKind): boolean {
  return PRIORITY_KINDS.includes(kind);
}
