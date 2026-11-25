// UPI rotation and payment links. pickUpiAccount mirrors the SQL in open_surprise().

export interface RotationAccount {
  id: string;
  ownerUserId: string | null;
  sortOrder: number;
  active: boolean;
  /** People already assigned to this account for this celebration. */
  assignedCount: number;
}

export interface RotationResult {
  accountId: string | null;
  /** True when every eligible account already had payersPerUpi people. */
  allFull: boolean;
}

/**
 * Pick the UPI account for the next payer of a celebration.
 * 1. Skip inactive accounts and any account owned by the birthday person.
 * 2. Fill accounts in sort order until each has `payersPerUpi` people.
 * 3. When all are full, use the least-filled one (ties by sort order) and report allFull.
 */
export function pickUpiAccount(
  accounts: RotationAccount[],
  birthdayUserId: string,
  payersPerUpi: number,
): RotationResult {
  const eligible = accounts
    .filter((a) => a.active && a.ownerUserId !== birthdayUserId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (eligible.length === 0) return { accountId: null, allFull: false };

  const open = eligible.find((a) => a.assignedCount < payersPerUpi);
  if (open) return { accountId: open.id, allFull: false };

  const least = eligible.reduce((best, a) => (a.assignedCount < best.assignedCount ? a : best));
  return { accountId: least.id, allFull: true };
}

export interface UpiLinkInput {
  upiId: string;
  payeeName: string;
  /** Rupees. Omit for "any amount" rooms. */
  amount?: number | null;
  note?: string;
}

/** upi://pay?pa=<upi>&pn=<payee>&am=<amount>&cu=INR&tn=<note> */
export function buildUpiLink({ upiId, payeeName, amount, note }: UpiLinkInput): string {
  const params: [string, string][] = [
    ["pa", upiId],
    ["pn", payeeName],
  ];
  if (amount != null && amount > 0) params.push(["am", amount.toFixed(2)]);
  params.push(["cu", "INR"]);
  if (note) params.push(["tn", note.slice(0, 50)]);
  return "upi://pay?" + params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
}

// Same rule as the room_upi_accounts check constraint in the database.
export const UPI_ID_PATTERN = /^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,64}$/;

export function isValidUpiId(value: string): boolean {
  const v = value.trim();
  return v.length <= 320 && UPI_ID_PATTERN.test(v);
}

/** "₹900" */
export function formatRupees(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN");
}
