import { describe, expect, it } from "vitest";
import { slugify, sha256 } from "./crypto";
import { ALL_PERMISSION_KEYS, SYSTEM_ROLES } from "./rbac/catalog";
import { AppError, originAllowed, rateLimit } from "./http";
import { tenantWhere } from "./tenancy/scope";

describe("slugify", () => {
  it("normalizes company names", () => {
    expect(slugify("Acme Roofing LLC")).toBe("acme-roofing-llc");
  });
});

describe("sha256", () => {
  it("hashes stably", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
    expect(sha256("abc")).not.toBe(sha256("abd"));
  });
});

describe("permissions catalog", () => {
  it("includes the required permission keys", () => {
    expect(ALL_PERMISSION_KEYS).toContain("customers.view");
    expect(ALL_PERMISSION_KEYS).toContain("projects.view");
    expect(ALL_PERMISSION_KEYS).toContain("media.upload");
    expect(ALL_PERMISSION_KEYS).toContain("company.settings");
    expect(ALL_PERMISSION_KEYS).toContain("integrations.view");
    expect(ALL_PERMISSION_KEYS).toContain("integrations.manage");
  });

  it("gives owner every permission", () => {
    const owner = SYSTEM_ROLES.find((r) => r.key === "owner");
    expect(owner?.permissions).toBe("*");
  });
});

describe("tenantWhere", () => {
  it("always scopes by company and excludes soft-deleted rows", () => {
    expect(tenantWhere("co_1", { id: "p1" })).toEqual({
      companyId: "co_1",
      deletedAt: null,
      id: "p1",
    });
  });
});

describe("originAllowed", () => {
  const app = "http://localhost:3001";

  it("allows the Android emulator host on the app port", () => {
    const prev = process.env.APP_URL;
    process.env.APP_URL = app;
    const request = new Request("http://localhost:3001/api/v1/auth/login", {
      method: "POST",
      headers: { origin: "http://10.0.2.2:3001" },
    });
    expect(originAllowed(request)).toBe(true);
    process.env.APP_URL = prev;
  });

  it("rejects a different public origin", () => {
    const prev = process.env.APP_URL;
    process.env.APP_URL = app;
    const request = new Request("http://localhost:3001/api/v1/auth/login", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect(originAllowed(request)).toBe(false);
    process.env.APP_URL = prev;
  });
});

describe("rateLimit", () => {
  it("blocks excessive attempts", () => {
    const key = `test-${Date.now()}`;
    for (let i = 0; i < 3; i += 1) rateLimit(key, 3, 60_000);
    expect(() => rateLimit(key, 3, 60_000)).toThrow(AppError);
  });
});
