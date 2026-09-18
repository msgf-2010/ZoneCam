import { describe, expect, it } from "vitest";
import { projectScopeWhere, isAssignedOnlyRole } from "./tenancy/access";
import { formatAddress } from "../lib/format";
import type { AuthContext } from "./auth/context";

function ctx(roleKey: string, userId = "u1", companyId = "c1"): AuthContext {
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
    company: { id: companyId, name: "Co", slug: "co", timezone: "UTC" },
    membershipId: "m1",
    role: { id: "r1", key: roleKey, name: roleKey },
    permissions: new Set(["projects.view"]),
  };
}

describe("project tenancy", () => {
  it("office roles see all company projects", () => {
    const where = projectScopeWhere(ctx("office"));
    expect(where.companyId).toBe("c1");
    expect(where.deletedAt).toBeNull();
    expect(where.members).toBeUndefined();
  });

  it("field technicians only see assigned projects", () => {
    expect(isAssignedOnlyRole(ctx("field_technician"))).toBe(true);
    const where = projectScopeWhere(ctx("field_technician", "tech1"));
    expect(where.members).toEqual({ some: { userId: "tech1" } });
  });

  it("never queries without a company id", () => {
    const where = projectScopeWhere(ctx("owner", "u1", "tenant-a"));
    expect(where.companyId).toBe("tenant-a");
  });
});

describe("formatAddress", () => {
  it("joins populated address parts", () => {
    expect(
      formatAddress({
        addressLine1: "12 Oak St",
        city: "Austin",
        region: "TX",
        postalCode: "78701",
      }),
    ).toBe("12 Oak St · Austin, TX, 78701");
  });
});
