import { z } from "zod";
import { prisma } from "@/server/db";
import type { AuthContext } from "@/server/auth/context";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/http";
import { writeAuditLog } from "@/server/audit";
import { syncCompanyRbac } from "@/server/tenancy/provision";
import { isAssignedOnlyRole, projectScopeWhere } from "@/server/tenancy/access";

const optionalText = z.string().trim().max(200).optional().nullable();

const customerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  customerNumber: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(160).optional().nullable().or(z.literal("")),
  phone: optionalText,
  addressLine1: optionalText,
  addressLine2: optionalText,
  city: optionalText,
  region: optionalText,
  postalCode: z.string().trim().max(20).optional().nullable(),
  country: optionalText,
  notes: z.string().trim().max(4000).optional().nullable(),
  contact: z
    .object({
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().min(1).max(80),
      email: z.string().trim().email().max(160).optional().nullable().or(z.literal("")),
      phone: optionalText,
      title: optionalText,
    })
    .optional(),
});

function emptyToNull(value?: string | null) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function listCustomers(ctx: AuthContext, query?: string) {
  requirePermission(ctx, "customers.view");
  await syncCompanyRbac(prisma, ctx.company.id);
  return prisma.customer.findMany({
    where: {
      companyId: ctx.company.id,
      deletedAt: null,
      ...(isAssignedOnlyRole(ctx)
        ? { projects: { some: projectScopeWhere(ctx) } }
        : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query } },
              { email: { contains: query } },
              { customerNumber: { contains: query } },
            ],
          }
        : {}),
    },
    include: {
      contacts: { where: { deletedAt: null }, orderBy: { isPrimary: "desc" } },
            _count: { select: { projects: { where: { deletedAt: null } } } },
    },
    orderBy: { name: "asc" },
    take: 50,
  });
}

export async function getCustomer(ctx: AuthContext, id: string) {
  requirePermission(ctx, "customers.view");
  const customer = await prisma.customer.findFirst({
    where: { id, companyId: ctx.company.id, deletedAt: null },
    include: {
      contacts: { where: { deletedAt: null }, orderBy: { isPrimary: "desc" } },
      projects: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          number: true,
          projectStatus: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      },
    },
  });
  if (!customer) throw new AppError(404, "Not found.");
  if (isAssignedOnlyRole(ctx)) {
    const assigned = await prisma.project.findFirst({
      where: { customerId: id, ...projectScopeWhere(ctx) },
    });
    if (!assigned) throw new AppError(404, "Not found.");
  }
  return customer;
}

export async function createCustomer(ctx: AuthContext, input: unknown, meta: { ip?: string | null }) {
  requirePermission(ctx, "customers.create");
  const data = customerSchema.parse(input);
  const customer = await prisma.$transaction(async (tx) => {
    const created = await tx.customer.create({
      data: {
        companyId: ctx.company.id,
        name: data.name,
        customerNumber: emptyToNull(data.customerNumber),
        email: emptyToNull(data.email),
        phone: emptyToNull(data.phone),
        addressLine1: emptyToNull(data.addressLine1),
        addressLine2: emptyToNull(data.addressLine2),
        city: emptyToNull(data.city),
        region: emptyToNull(data.region),
        postalCode: emptyToNull(data.postalCode),
        country: emptyToNull(data.country),
        notes: emptyToNull(data.notes),
      },
    });
    if (data.contact) {
      await tx.customerContact.create({
        data: {
          companyId: ctx.company.id,
          customerId: created.id,
          firstName: data.contact.firstName,
          lastName: data.contact.lastName,
          email: emptyToNull(data.contact.email),
          phone: emptyToNull(data.contact.phone),
          title: emptyToNull(data.contact.title),
          isPrimary: true,
        },
      });
    }
    return created;
  });
  await writeAuditLog({
    action: "customer.create",
    companyId: ctx.company.id,
    userId: ctx.user.id,
    entityType: "customer",
    entityId: customer.id,
    ipAddress: meta.ip,
  });
  return getCustomer(ctx, customer.id);
}

export async function updateCustomer(ctx: AuthContext, id: string, input: unknown, meta: { ip?: string | null }) {
  requirePermission(ctx, "customers.edit");
  await getCustomer(ctx, id);
  const data = customerSchema.partial().parse(input);
  await prisma.customer.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name } : {}),
      customerNumber: data.customerNumber !== undefined ? emptyToNull(data.customerNumber) : undefined,
      email: data.email !== undefined ? emptyToNull(data.email) : undefined,
      phone: data.phone !== undefined ? emptyToNull(data.phone) : undefined,
      addressLine1: data.addressLine1 !== undefined ? emptyToNull(data.addressLine1) : undefined,
      addressLine2: data.addressLine2 !== undefined ? emptyToNull(data.addressLine2) : undefined,
      city: data.city !== undefined ? emptyToNull(data.city) : undefined,
      region: data.region !== undefined ? emptyToNull(data.region) : undefined,
      postalCode: data.postalCode !== undefined ? emptyToNull(data.postalCode) : undefined,
      country: data.country !== undefined ? emptyToNull(data.country) : undefined,
      notes: data.notes !== undefined ? emptyToNull(data.notes) : undefined,
    },
  });
  await writeAuditLog({
    action: "customer.update",
    companyId: ctx.company.id,
    userId: ctx.user.id,
    entityType: "customer",
    entityId: id,
    ipAddress: meta.ip,
  });
  return getCustomer(ctx, id);
}

export async function deleteCustomer(ctx: AuthContext, id: string, meta: { ip?: string | null }) {
  requirePermission(ctx, "customers.delete");
  await getCustomer(ctx, id);
  await prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await writeAuditLog({
    action: "customer.delete",
    companyId: ctx.company.id,
    userId: ctx.user.id,
    entityType: "customer",
    entityId: id,
    ipAddress: meta.ip,
  });
}

const contactSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160).optional().nullable().or(z.literal("")),
  phone: optionalText,
  title: optionalText,
  isPrimary: z.boolean().optional(),
});

export async function addCustomerContact(
  ctx: AuthContext,
  customerId: string,
  input: unknown,
  meta: { ip?: string | null },
) {
  requirePermission(ctx, "customers.edit");
  await getCustomer(ctx, customerId);
  const data = contactSchema.parse(input);
  if (data.isPrimary) {
    await prisma.customerContact.updateMany({
      where: { customerId, companyId: ctx.company.id },
      data: { isPrimary: false },
    });
  }
  const contact = await prisma.customerContact.create({
    data: {
      companyId: ctx.company.id,
      customerId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: emptyToNull(data.email),
      phone: emptyToNull(data.phone),
      title: emptyToNull(data.title),
      isPrimary: data.isPrimary ?? false,
    },
  });
  await writeAuditLog({
    action: "customer.contact.create",
    companyId: ctx.company.id,
    userId: ctx.user.id,
    entityType: "customer_contact",
    entityId: contact.id,
    ipAddress: meta.ip,
  });
  return contact;
}
