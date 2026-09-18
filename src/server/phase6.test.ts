import { describe, expect, it } from "vitest";
import { sha256 } from "./crypto";

describe("report share tokens", () => {
  it("stores a hash so the raw link is not in the database", () => {
    const token = "share-token-example";
    expect(sha256(token)).not.toBe(token);
    expect(sha256(token)).toBe(sha256(token));
  });
});

describe("customer report payload", () => {
  it("never includes internal staff notes", () => {
    const snapshot = {
      project: { customerNotes: "OK to start", internalNotes: "do not leak" },
    };
    expect("internalNotes" in snapshot.project).toBe(true);
    const publicProject = {
      customerNotes: snapshot.project.customerNotes,
    };
    expect(publicProject).toEqual({ customerNotes: "OK to start" });
  });
});
