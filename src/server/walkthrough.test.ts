import { describe, expect, it } from "vitest";
import { classifyTrade, GENERAL_TRADE } from "../lib/trades";
import { buildWalkthroughChecklist, toChecklistTitle } from "./ai/walkthrough";
import { mediaKindFromMime } from "./media/types";
import { securityHeaders } from "./security";

describe("walkthrough inspector", () => {
  it("classifies spoken notes by trade", () => {
    expect(classifyTrade("the bathroom faucet is leaking under the sink")).toBe("Plumber");
    expect(classifyTrade("this wall needs paint and the trim is scuffed")).toBe("Painter");
    expect(classifyTrade("gfci outlet in the kitchen is dead")).toBe("Electrician");
    expect(classifyTrade("nothing trade specific here")).toBe(GENERAL_TRADE.name);
  });

  it("turns a narrated walkthrough into a trade-grouped office checklist", () => {
    const result = buildWalkthroughChecklist({
      jobName: "12 Oak",
      jobType: "Service",
      durationMs: 45_000,
      transcript: "The bathroom faucet is leaking. This hallway wall needs paint.",
      segments: [
        { startMs: 4000, endMs: 9000, text: "the bathroom faucet is leaking under the sink", screenshotIndex: 0 },
        { startMs: 18000, endMs: 24000, text: "this hallway wall needs paint, it's scuffed", screenshotIndex: 1 },
      ],
      screenshotCount: 2,
    });
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.trade)).toEqual(["Plumber", "Painter"]);
    expect(result.items.find((item) => item.trade === "Plumber")?.screenshotIndex).toBe(0);
    expect(result.items.find((item) => item.trade === "Painter")?.screenshotIndex).toBe(1);
    expect(result.summary).toContain("Painter");
    expect(result.summary).toContain("Plumber");
  });

  it("falls back to timed review items when there is no transcript", () => {
    const result = buildWalkthroughChecklist({
      durationMs: 12_000,
      transcript: "",
      segments: [],
      screenshotCount: 3,
    });
    expect(result.items.length).toBe(3);
    expect(result.items.every((item) => item.trade === "General")).toBe(true);
    expect(result.items[1]?.title).toContain("0:04");
  });

  it("writes an actionable title from speech", () => {
    expect(toChecklistTitle("the bathroom faucet is leaking", "Plumber")).toMatch(/leak/i);
  });
});

describe("walkthrough media types", () => {
  it("accepts recorder mime types with codec parameters", () => {
    expect(mediaKindFromMime("video/webm;codecs=vp8,opus")).toBe("video");
    expect(mediaKindFromMime("audio/webm;codecs=opus")).toBe("file");
  });
});

describe("field microphone policy", () => {
  it("allows camera and microphone on the same origin", () => {
    expect(securityHeaders("/field")["Permissions-Policy"]).toContain("microphone=(self)");
    expect(securityHeaders("/field")["Permissions-Policy"]).toContain("camera=(self)");
  });
});
