import { describe, expect, it } from "vitest";
import { buildUpiLink, isValidUpiId, pickUpiAccount, type RotationAccount } from "./upi";

const acc = (id: string, sortOrder: number, assignedCount = 0, ownerUserId: string | null = null, active = true): RotationAccount => ({
  id,
  sortOrder,
  assignedCount,
  ownerUserId,
  active,
});

describe("pickUpiAccount", () => {
  it("fills the first account until it is full", () => {
    const r = pickUpiAccount([acc("a", 0, 19), acc("b", 1, 0)], "bday", 20);
    expect(r).toEqual({ accountId: "a", allFull: false });
  });

  it("gives the 21st payer the second UPI ID", () => {
    const r = pickUpiAccount([acc("a", 0, 20), acc("b", 1, 0)], "bday", 20);
    expect(r).toEqual({ accountId: "b", allFull: false });
  });

  it("respects sort order, not array order", () => {
    const r = pickUpiAccount([acc("b", 1), acc("a", 0)], "bday", 20);
    expect(r.accountId).toBe("a");
  });

  it("skips an account owned by the birthday person", () => {
    const r = pickUpiAccount([acc("mod", 0, 0, "bday"), acc("b", 1)], "bday", 20);
    expect(r.accountId).toBe("b");
  });

  it("skips inactive accounts", () => {
    const r = pickUpiAccount([acc("a", 0, 0, null, false), acc("b", 1)], "bday", 20);
    expect(r.accountId).toBe("b");
  });

  it("uses the least-filled account when all are full and reports it", () => {
    const r = pickUpiAccount([acc("a", 0, 25), acc("b", 1, 21), acc("c", 2, 22)], "bday", 20);
    expect(r).toEqual({ accountId: "b", allFull: true });
  });

  it("breaks least-filled ties by sort order", () => {
    const r = pickUpiAccount([acc("b", 1, 20), acc("a", 0, 20)], "bday", 20);
    expect(r).toEqual({ accountId: "a", allFull: true });
  });

  it("returns null when nothing is eligible", () => {
    expect(pickUpiAccount([acc("mod", 0, 0, "bday")], "bday", 20)).toEqual({ accountId: null, allFull: false });
    expect(pickUpiAccount([], "bday", 20)).toEqual({ accountId: null, allFull: false });
  });
});

describe("buildUpiLink", () => {
  it("builds a link with amount and note", () => {
    expect(buildUpiLink({ upiId: "aarav@okaxis", payeeName: "Aarav S", amount: 50, note: "Riya birthday" })).toBe(
      "upi://pay?pa=aarav%40okaxis&pn=Aarav%20S&am=50.00&cu=INR&tn=Riya%20birthday",
    );
  });

  it("omits the amount for any-amount rooms", () => {
    expect(buildUpiLink({ upiId: "a@ybl", payeeName: "A", amount: null })).toBe("upi://pay?pa=a%40ybl&pn=A&cu=INR");
  });
});

describe("isValidUpiId", () => {
  it("accepts handles and rejects junk", () => {
    expect(isValidUpiId("riya.k-2@okhdfcbank")).toBe(true);
    expect(isValidUpiId("no-at-sign")).toBe(false);
    expect(isValidUpiId("a@1")).toBe(false);
  });
});
