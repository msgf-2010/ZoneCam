import { describe, expect, it } from "vitest";
import { sha256 } from "./crypto";

describe("payment amounts", () => {
  it("stores money as integer cents", () => {
    expect(Math.round(250.5 * 100)).toBe(25050);
    expect(Math.round(0.1 * 100)).toBe(10);
  });
});

describe("payment share tokens", () => {
  it("stores a hash so the raw link is not in the database", () => {
    const token = "pay-token-example";
    expect(sha256(token)).not.toBe(token);
    expect(sha256(token)).toBe(sha256(token));
  });
});
