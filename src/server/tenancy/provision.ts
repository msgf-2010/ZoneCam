import type { Prisma, PrismaClient } from "@prisma/client";
import {
  ALL_PERMISSION_KEYS,
  DEFAULT_PROJECT_STATUSES,
  DEFAULT_PROJECT_TYPES,
  PERMISSIONS,
  SYSTEM_ROLES,
} from "@/server/rbac/catalog";

type Db = PrismaClient | Prisma.TransactionClient;

export async function ensureGlobalPermissions(db: Db) {
  for (const permission of PERMISSIONS) {
    await db.permission.upsert({
      where: { key: permission.key },
      update: { category: permission.category, description: permission.description },
      create: permission,
    });
  }
}

export async function provisionCompanyDefaults(db: Db, companyId: string) {
  await ensureGlobalPermissions(db);
  const permissions = await db.permission.findMany({
    where: { key: { in: [...ALL_PERMISSION_KEYS] } },
  });
  const byKey = new Map(permissions.map((p) => [p.key, p.id]));

  for (const role of SYSTEM_ROLES) {
    const created = await db.role.upsert({
      where: { companyId_key: { companyId, key: role.key } },
      update: { name: role.name, description: role.description, isSystem: true },
      create: {
        companyId,
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    });
    const keys = role.permissions === "*" ? ALL_PERMISSION_KEYS : role.permissions;
    await db.rolePermission.deleteMany({ where: { roleId: created.id } });
    await db.rolePermission.createMany({
      data: keys.map((key) => ({
        roleId: created.id,
        permissionId: byKey.get(key)!,
      })),
    });
  }

  for (const status of DEFAULT_PROJECT_STATUSES) {
    await db.projectStatus.upsert({
      where: { companyId_key: { companyId, key: status.key } },
      update: status,
      create: { companyId, ...status },
    });
  }

  for (const type of DEFAULT_PROJECT_TYPES) {
    await db.projectType.upsert({
      where: { companyId_key: { companyId, key: type.key } },
      update: { name: type.name },
      create: { companyId, ...type },
    });
  }
}

/** Adds newly catalogued permissions to existing system roles without wiping custom grants. */
export async function syncCompanyRbac(db: Db, companyId: string) {
  await ensureGlobalPermissions(db);
  const permissions = await db.permission.findMany({
    where: { key: { in: [...ALL_PERMISSION_KEYS] } },
  });
  const byKey = new Map(permissions.map((p) => [p.key, p.id]));

  for (const role of SYSTEM_ROLES) {
    const existing = await db.role.upsert({
      where: { companyId_key: { companyId, key: role.key } },
      update: { name: role.name, description: role.description, isSystem: true },
      create: {
        companyId,
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    });
    const keys = role.permissions === "*" ? ALL_PERMISSION_KEYS : role.permissions;
    for (const key of keys) {
      const permissionId = byKey.get(key);
      if (!permissionId) continue;
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: existing.id, permissionId } },
        update: {},
        create: { roleId: existing.id, permissionId },
      });
    }
  }
}
