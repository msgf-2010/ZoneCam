import { z } from "zod";
import { prisma } from "@/server/db";
import type { AuthContext } from "@/server/auth/context";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/http";
import { writeAuditLog } from "@/server/audit";
import { recordTimeline } from "@/server/timeline";
import { loadScopedProject, projectScopeWhere, isAssignedOnlyRole } from "@/server/tenancy/access";
import { randomToken, sha256 } from "@/server/crypto";
import { getEnv } from "@/lib/env";
import { sendCompanyEmail } from "@/server/services/integration-service";
import { createPaymentProvider } from "@/server/adapters/payments";
import { notifyUsers, projectAudienceUserIds } from "@/server/services/notification-service";

const paymentInclude = {
  project: { select: { id: true, name: true, number: true } },
  customer: { select: { id: true, name: true, email: true } },
  company: { select: { name: true } },
} as const;

function dollarsToCents(amount: string) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new AppError(400, "Enter an amount greater than zero.");
  return Math.round(value * 100);
}

async function loadOwnedPayment(ctx: AuthContext, id: string) {
  requirePermission(ctx, "payments.view");
  const payment = await prisma.payment.findFirst({
    where: { id, companyId: ctx.company.id },
    include: paymentInclude,
  });
  if (!payment) throw new AppError(404, "Not found.");
  if (payment.projectId) await loadScopedProject(ctx, payment.projectId);
  return payment;
}

export async function listPayments(ctx: AuthContext, projectId?: string) {
  requirePermission(ctx, "payments.view");
  if (projectId) await loadScopedProject(ctx, projectId);
  return prisma.payment.findMany({
    where: {
      companyId: ctx.company.id,
      ...(projectId ? { projectId } : {}),
      ...(isAssignedOnlyRole(ctx) && !projectId ? { project: projectScopeWhere(ctx) } : {}),
    },
    include: paymentInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getPayment(ctx: AuthContext, id: string) {
  return loadOwnedPayment(ctx, id);
}

export async function createPayment(ctx: AuthContext, input: unknown) {
  requirePermission(ctx, "payments.create");
  const data = z
    .object({
      projectId: z.string().min(1),
      customerId: z.string().optional(),
      amount: z.string().min(1),
      description: z.string().trim().max(240).optional(),
      payerName: z.string().trim().max(120).optional(),
      payerEmail: z.string().trim().max(160).optional(),
    })
    .parse(input);
  const payerEmail = data.payerEmail?.toLowerCase() || "";
  if (payerEmail && !z.string().email().safeParse(payerEmail).success) {
    throw new AppError(400, "Enter a valid payer email.");
  }
  const project = await loadScopedProject(ctx, data.projectId);
  const customerId = data.customerId || project.customerId;
  if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId: ctx.company.id, deletedAt: null },
    });
    if (!customer) throw new AppError(400, "Customer not found.");
  }
  const payment = await prisma.payment.create({
    data: {
      companyId: ctx.company.id,
      projectId: project.id,
      customerId,
      amountCents: dollarsToCents(data.amount),
      description: [data.description?.trim() || `${project.number} payment`, data.payerName?.trim(), payerEmail]
        .filter(Boolean)
        .join(" · "),
      status: "draft",
      provider: "internal",
    },
    include: paymentInclude,
  });
  await recordTimeline({
    companyId: ctx.company.id,
    projectId: project.id,
    actorUserId: ctx.user.id,
    type: "payment.created",
    description: `${ctx.user.firstName} created a payment request`,
    entityType: "payment",
    entityId: payment.id,
  });
  await writeAuditLog({
    action: "payment.created",
    companyId: ctx.company.id,
    userId: ctx.user.id,
    entityType: "payment",
    entityId: payment.id,
  });
  return payment;
}

export async function requestPayment(ctx: AuthContext, id: string) {
  requirePermission(ctx, "payments.create");
  const payment = await loadOwnedPayment(ctx, id);
  if (payment.status === "paid" || payment.status === "cancelled") {
    throw new AppError(400, "This payment can no longer be requested.");
  }
  const token = randomToken(24);
  const provider = createPaymentProvider();
  let result;
  try {
    result = await provider.createPaymentRequest({
      amountCents: payment.amountCents,
      currency: payment.currency,
      description: payment.description,
    });
  } catch (error) {
    throw new AppError(400, error instanceof Error ? error.message : "Payments are not connected.");
  }
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "requested",
      provider: result.provider,
      providerTransactionId: result.providerTransactionId,
      shareTokenHash: sha256(token),
    },
    include: paymentInclude,
  });
  const url = `${getEnv().APP_URL}/share/p/${token}`;
  const to = payerEmailFrom(payment) || payment.customer?.email;
  if (to) {
    await sendCompanyEmail(ctx.company.id, {
      to,
      subject: `Payment requested: ${payment.description}`,
      text: `Please review this payment request from ${ctx.company.name}:\n${url}\nCard processing is not connected yet; contact the office to pay.`,
    });
  }
  await recordTimeline({
    companyId: ctx.company.id,
    projectId: payment.projectId,
    actorUserId: ctx.user.id,
    type: "payment.requested",
    description: `${ctx.user.firstName} requested payment`,
    entityType: "payment",
    entityId: payment.id,
  });
  if (payment.projectId) {
    const audience = await projectAudienceUserIds(ctx.company.id, payment.projectId, ctx.user.id);
    await notifyUsers({
      companyId: ctx.company.id,
      userIds: audience,
      actorUserId: ctx.user.id,
      type: "project.message",
      title: "Payment requested",
      body: payment.description,
      entityType: "payment",
      entityId: payment.id,
      projectId: payment.projectId,
    });
  }
  return { payment: updated, url, emailed: Boolean(to) };
}

export async function markPaymentPaid(ctx: AuthContext, id: string) {
  requirePermission(ctx, "payments.create");
  const payment = await loadOwnedPayment(ctx, id);
  if (payment.status === "cancelled") throw new AppError(400, "Cancelled payments cannot be marked paid.");
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "paid", paidAt: new Date() },
    include: paymentInclude,
  });
  await recordTimeline({
    companyId: ctx.company.id,
    projectId: payment.projectId,
    actorUserId: ctx.user.id,
    type: "payment.paid",
    description: `${ctx.user.firstName} recorded payment received`,
    entityType: "payment",
    entityId: payment.id,
  });
  await writeAuditLog({
    action: "payment.paid",
    companyId: ctx.company.id,
    userId: ctx.user.id,
    entityType: "payment",
    entityId: payment.id,
  });
  return updated;
}

export async function cancelPayment(ctx: AuthContext, id: string) {
  requirePermission(ctx, "payments.create");
  const payment = await loadOwnedPayment(ctx, id);
  if (payment.status === "paid") throw new AppError(400, "Paid requests cannot be cancelled.");
  return prisma.payment.update({
    where: { id: payment.id },
    data: { status: "cancelled" },
    include: paymentInclude,
  });
}

function payerEmailFrom(payment: { description: string; customer?: { email: string | null } | null }) {
  const match = payment.description.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase() ?? payment.customer?.email ?? "";
}

export async function getPublicPayment(token: string) {
  const payment = await prisma.payment.findFirst({
    where: { shareTokenHash: sha256(token) },
    include: {
      company: { select: { name: true } },
      project: { select: { name: true, number: true } },
    },
  });
  if (!payment) throw new AppError(404, "Not found.");
  return {
    id: payment.id,
    description: payment.description,
    amountCents: payment.amountCents,
    currency: payment.currency,
    status: payment.status,
    paidAt: payment.paidAt,
    company: payment.company.name,
    project: payment.project ? { name: payment.project.name, number: payment.project.number } : null,
    processor: payment.provider,
  };
}
