import { describe, expect, it } from "vitest";
import { parseMentionIds } from "../lib/mentions";

describe("mentions", () => {
  const people = [
    { id: "u1", firstName: "Maya", lastName: "Chen" },
    { id: "u2", firstName: "Moe", lastName: "Owner" },
  ];

  it("finds @First Last mentions", () => {
    expect(parseMentionIds("Need @Maya Chen on site", people)).toEqual(["u1"]);
  });

  it("does not mention people who were not tagged", () => {
    expect(parseMentionIds("Maya please advise", people)).toEqual([]);
  });
});
