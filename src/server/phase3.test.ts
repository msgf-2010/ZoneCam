import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "file:./dev.db";
process.env.AUTH_SECRET ??= "dev-only-change-me-in-production-32ch";
import { mediaKindFromMime } from "./media/types";
import { readImageSize } from "./media/inspect";
import { makeJpegThumbnail, THUMB_MAX_EDGE } from "./media/thumbnail";
import { hmacSign, hmacVerify } from "./crypto";
import sharp from "sharp";

describe("media mime validation", () => {
  it("accepts photos and videos we support", () => {
    expect(mediaKindFromMime("image/jpeg")).toBe("photo");
    expect(mediaKindFromMime("video/mp4")).toBe("video");
    expect(mediaKindFromMime("application/pdf")).toBeNull();
  });
});

describe("image headers", () => {
  it("reads PNG dimensions without decoding pixels", () => {
    const png = Buffer.from(
      "89504e470d0a1a0a0000000d494844520000000400000003080600000000",
      "hex",
    );
    expect(readImageSize(png)).toEqual({ width: 4, height: 3 });
  });
});

describe("jpeg thumbnails", () => {
  it("stores a smaller square jpeg than the original", async () => {
    const original = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: { r: 40, g: 80, b: 90 } },
    })
      .jpeg({ quality: 90 })
      .toBuffer();
    const thumb = await makeJpegThumbnail(original);
    const meta = await sharp(thumb).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(THUMB_MAX_EDGE);
    expect(meta.height).toBe(THUMB_MAX_EDGE);
    expect(thumb.length).toBeLessThan(original.length / 4);
  });
});

describe("media access signatures", () => {
  it("verifies HMAC signatures", () => {
    process.env.AUTH_SECRET = process.env.AUTH_SECRET || "dev-only-change-me-in-production-32ch";
    process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";
    const value = "media1:original:9999999999999";
    const sig = hmacSign(value);
    expect(hmacVerify(value, sig)).toBe(true);
    expect(hmacVerify("other", sig)).toBe(false);
  });
});
