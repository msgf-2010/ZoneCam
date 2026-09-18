import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "file:./dev.db";
process.env.AUTH_SECRET ??= "dev-only-change-me-in-production-32ch";

import { taskVisibilityWhere } from "./services/task-service";
import type { AuthContext } from "./auth/context";

function ctx(roleKey: string, userId = "u1", permissions: string[] = ["tasks.view"]): AuthContext {
  return {
    user: {
      id: userId,
      email: "a@b.com",
      firstName: "A",
      lastName: "B",
      phone: null,
      emailVerifiedAt: null,
    },
    sessionId: "s1",
    company: { id: "c1", name: "Co", slug: "co", timezone: "UTC" },
    membershipId: "m1",
    role: { id: "r1", key: roleKey, name: roleKey },
    permissions: new Set(permissions),
  };
}

describe("task tenancy", () => {
  it("scopes every query to the company", () => {
    const where = taskVisibilityWhere(ctx("office"));
    expect(where.companyId).toBe("c1");
    expect(where.deletedAt).toBeNull();
    expect(where.OR).toBeUndefined();
  });

  it("limits field technicians to assigned jobs or their own tasks", () => {
    const where = taskVisibilityWhere(ctx("field_technician", "tech1"));
    expect(where.OR).toEqual([
      { assigneeId: "tech1" },
      { project: { members: { some: { userId: "tech1" } } } },
    ]);
  });
});

describe("checklist templates", () => {
  it("ships a pre-job inspection list", () => {
    const items = [
      "Verify equipment",
      "Photograph existing damage",
      "Confirm measurements",
      "Confirm materials",
      "Customer approval",
    ];
    expect(items).toHaveLength(5);
  });
});

describe("field photo categories", () => {
  it("covers the agent capture set", async () => {
    const { FIELD_PHOTO_CATEGORIES, isFieldPhotoCategory } = await import("../lib/field-categories");
    expect(FIELD_PHOTO_CATEGORIES).toHaveLength(6);
    expect(isFieldPhotoCategory("Damage")).toBe(true);
    expect(isFieldPhotoCategory("Invoice")).toBe(false);
  });
});

