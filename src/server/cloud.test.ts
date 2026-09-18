import { describe, expect, it } from "vitest";
import { r2Configured, r2Endpoint } from "./adapters/r2-storage";
import { clientIp } from "./http";

describe("cloudflare r2", () => {
  it("builds the account endpoint and refuses an empty config", () => {
    expect(r2Endpoint("abc123")).toBe("https://abc123.r2.cloudflarestorage.com");
    expect(r2Endpoint("abc123", "https://custom.example/")).toBe("https://custom.example");
    expect(
      r2Configured({ accountId: "", bucket: "media", accessKeyId: "id", secretAccessKey: "secret" }),
    ).toBe(false);
    expect(
      r2Configured({ accountId: "abc", bucket: "media", accessKeyId: "id", secretAccessKey: "secret" }),
    ).toBe(true);
  });
});

describe("cloudflare client ip", () => {
  it("uses CF-Connecting-IP when TRUST_CLOUDFLARE is set", () => {
    const prev = process.env.TRUST_CLOUDFLARE;
    process.env.TRUST_CLOUDFLARE = "true";
    const request = new Request("http://localhost:3001/api/v1/health", {
      headers: {
        "cf-connecting-ip": "203.0.113.9",
        "x-forwarded-for": "1.1.1.1",
      },
    });
    expect(clientIp(request)).toBe("203.0.113.9");
    process.env.TRUST_CLOUDFLARE = prev;
  });
});
