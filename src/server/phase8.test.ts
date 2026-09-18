import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { captionFromInspection, inspectPhotoBuffer } from "./ai/inspect-photo";

describe("photo inspector", () => {
  it("reads dimensions and writes a caption from real pixels", async () => {
    const buffer = await sharp({
      create: { width: 320, height: 200, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      .jpeg()
      .toBuffer();
    const inspection = await inspectPhotoBuffer(buffer);
    expect(inspection.width).toBe(320);
    expect(inspection.height).toBe(200);
    expect(inspection.exposure).toBe("dark");
    const caption = captionFromInspection(inspection, { filename: "site.jpg", tags: ["Damage"], hasGps: true });
    expect(caption).toContain("Inspector:");
    expect(caption).toContain("320×200");
    expect(caption).toContain("Damage");
    expect(caption).toContain("dark");
    expect(caption).toContain("GPS");
  });
});
