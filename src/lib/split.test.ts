import { describe, expect, it } from "vitest";
import { dobAllowed } from "./dates";
import { checkContribution, isPriority, pickWinner, splitAmount } from "./split";

describe("splitAmount", () => {
  it("divides equally and rounds up so the total is covered", () => {
    expect(splitAmount(900, 18)).toBe(50);
    expect(splitAmount(1000, 21)).toBe(48); // 21 × 48 = 1008 ≥ 1000
    expect(splitAmount(null, 20)).toBeNull();
    expect(splitAmount(500, 0)).toBe(500);
  });
});

describe("checkContribution", () => {
  it("never allows less than the split", () => {
    expect(checkContribution(48, 48)).toBeNull();
    expect(checkContribution(100, 48)).toBeNull();
    expect(checkContribution(20, 48)).toMatch(/₹48/);
    expect(checkContribution(null, 48)).toMatch(/at least/);
    expect(checkContribution(5, null)).toBeNull();
  });
});

describe("pickWinner", () => {
  it("picks the most votes, then the cheaper option, then list order", () => {
    expect(pickWinner([{ id: "a", price: 800, votes: 3, sortOrder: 0 }, { id: "b", price: 1000, votes: 5, sortOrder: 1 }])).toBe("b");
    expect(pickWinner([{ id: "a", price: 1000, votes: 4, sortOrder: 0 }, { id: "b", price: 800, votes: 4, sortOrder: 1 }])).toBe("b");
    expect(pickWinner([{ id: "a", price: null, votes: 0, sortOrder: 1 }, { id: "b", price: null, votes: 0, sortOrder: 0 }])).toBe("b");
    expect(pickWinner([])).toBeNull();
  });
});

describe("priority and birth year", () => {
  it("marks birthday reminders as priority", () => {
    expect(isPriority("day_before")).toBe(true);
    expect(isPriority("join_request")).toBe(false);
  });
  it("requires a birth year before the current year", () => {
    expect(dobAllowed("2005-08-15", "2026-11-26")).toBe(true);
    expect(dobAllowed("2025-12-31", "2026-11-26")).toBe(true);
    expect(dobAllowed("2026-01-01", "2026-11-26")).toBe(false);
    expect(dobAllowed("1899-01-01", "2026-11-26")).toBe(false);
    expect(dobAllowed("", "2026-11-26")).toBe(false);
  });
});
