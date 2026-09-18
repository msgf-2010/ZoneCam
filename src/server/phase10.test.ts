import { describe, expect, it } from "vitest";
import { safeInternalPath, safeDownloadFilename } from "@/lib/safe-path";
import { applySecurityHeaders } from "./security";
import { AppError, json, rateLimit } from "./http";
import { hrefForHit } from "./services/search-service";

describe("safeInternalPath", () => {
  it("blocks protocol-relative and foreign redirects", () => {
    expect(safeInternalPath("//evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeInternalPath("https://evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeInternalPath("/\\evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeInternalPath("/projects/abc", "/dashboard")).toBe("/projects/abc");
    expect(safeInternalPath("/login?next=/dashboard", "/field")).toBe("/login?next=/dashboard");
  });
});

describe("safeDownloadFilename", () => {
  it("strips header-breaking characters", () => {
    expect(safeDownloadFilename('a\r\nX-Inject: 1".png')).toBe("a X-Inject: 1 .png");
  });
});

describe("security headers", () => {
  it("adds nosniff and frame denial to JSON responses", () => {
    const secured = applySecurityHeaders(json({ ok: true }));
    expect(secured.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(secured.headers.get("X-Frame-Options")).toBe("DENY");
    expect(secured.headers.get("Cache-Control")).toBe("no-store");
    expect(secured.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });
});

describe("search hrefs", () => {
  it("keeps hits inside the app", () => {
    expect(hrefForHit({ index: "projects", id: "p1", title: "Job" })).toBe("/projects/p1");
    expect(hrefForHit({ index: "photos", id: "p1", title: "a.jpg" })).toBe("/projects/p1/media");
  });
});

describe("rateLimit", () => {
  it("still blocks a burst after hardening", () => {
    const key = `p10-${Date.now()}`;
    for (let i = 0; i < 3; i += 1) rateLimit(key, 3, 60_000);
    expect(() => rateLimit(key, 3, 60_000)).toThrow(AppError);
  });
});
