import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/rooms/abc?x=1")).toBe("/rooms/abc?x=1");
  });
  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNext("https://evil.example")).toBe("/rooms");
    expect(safeNext("//evil.example")).toBe("/rooms");
    expect(safeNext("/\\evil.example")).toBe("/rooms");
    expect(safeNext(null, "/")).toBe("/");
  });
});
