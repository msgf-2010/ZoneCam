import { prisma } from "@/server/db";
import type { AuthContext } from "@/server/auth/context";
import { AppError } from "@/server/http";
import { projectScopeWhere } from "@/server/tenancy/access";
import type { SearchHit, SearchIndex } from "@/server/adapters/search";

const PER_INDEX = 8;

function needle(query: string) {
  const value = query.trim().slice(0, 80);
  if (value.length < 2) throw new AppError(400, "Enter at least two characters.");
  return value;
}

export async function searchCompany(ctx: AuthContext, query: string): Promise<SearchHit[]> {
  const q = needle(query);
  const hits: SearchHit[] = [];
  const projectWhere = projectScopeWhere(ctx);

  const tasks: Array<Promise<void>> = [];

  if (ctx.permissions.has("projects.view")) {
    tasks.push(
      prisma.project
        .findMany({
          where: {
            ...projectWhere,
            OR: [{ name: { contains: q } }, { number: { contains: q } }, { city: { contains: q } }],
          },
          select: { id: true, name: true, number: true },
          take: PER_INDEX,
        })
        .then((rows) => {
          hits.push(
            ...rows.map((row) => ({
              index: "projects" as SearchIndex,
              id: row.id,
              title: `${row.number} ${row.name}`,
              subtitle: "Job",
            })),
          );
        }),
    );
    tasks.push(
      prisma.projectNote
        .findMany({
          where: { companyId: ctx.company.id, deletedAt: null, body: { contains: q }, project: projectWhere },
          select: { id: true, projectId: true, body: true },
          take: PER_INDEX,
        })
        .then((rows) => {
          hits.push(
            ...rows.map((row) => ({
              index: "notes" as SearchIndex,
              id: row.projectId,
              title: row.body.slice(0, 80),
              subtitle: "Note",
            })),
          );
        }),
    );
  }

  if (ctx.permissions.has("customers.view")) {
    tasks.push(
      prisma.customer
        .findMany({
          where: {
            companyId: ctx.company.id,
            deletedAt: null,
            OR: [{ name: { contains: q } }, { email: { contains: q } }, { customerNumber: { contains: q } }],
          },
          select: { id: true, name: true, email: true },
          take: PER_INDEX,
        })
        .then((rows) => {
          hits.push(
            ...rows.map((row) => ({
              index: "customers" as SearchIndex,
              id: row.id,
              title: row.name,
              subtitle: row.email ?? "Customer",
            })),
          );
        }),
    );
  }

  if (ctx.permissions.has("users.view")) {
    tasks.push(
      prisma.companyMembership
        .findMany({
          where: {
            companyId: ctx.company.id,
            deletedAt: null,
            status: "active",
            user: {
              deletedAt: null,
              OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }],
            },
          },
          select: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
          take: PER_INDEX,
        })
        .then((rows) => {
          hits.push(
            ...rows.map((row) => ({
              index: "people" as SearchIndex,
              id: row.user.id,
              title: `${row.user.firstName} ${row.user.lastName}`,
              subtitle: row.user.email,
            })),
          );
        }),
    );
  }

  if (ctx.permissions.has("media.view")) {
    tasks.push(
      prisma.media
        .findMany({
          where: {
            companyId: ctx.company.id,
            deletedAt: null,
            originalFilename: { contains: q },
            project: projectWhere,
          },
          select: { id: true, originalFilename: true, projectId: true },
          take: PER_INDEX,
        })
        .then((rows) => {
          hits.push(
            ...rows.map((row) => ({
              index: "photos" as SearchIndex,
              id: row.projectId ?? row.id,
              title: row.originalFilename,
              subtitle: "Photo",
            })),
          );
        }),
    );
  }

  if (ctx.permissions.has("tasks.view")) {
    tasks.push(
      prisma.task
        .findMany({
          where: {
            companyId: ctx.company.id,
            deletedAt: null,
            title: { contains: q },
            project: projectWhere,
          },
          select: { id: true, title: true, projectId: true },
          take: PER_INDEX,
        })
        .then((rows) => {
          hits.push(
            ...rows.map((row) => ({
              index: "tasks" as SearchIndex,
              id: row.id,
              title: row.title,
              subtitle: "Task",
            })),
          );
        }),
    );
  }

  if (ctx.permissions.has("reports.view")) {
    tasks.push(
      prisma.report
        .findMany({
          where: {
            companyId: ctx.company.id,
            deletedAt: null,
            title: { contains: q },
            project: projectWhere,
          },
          select: { id: true, title: true },
          take: PER_INDEX,
        })
        .then((rows) => {
          hits.push(
            ...rows.map((row) => ({
              index: "reports" as SearchIndex,
              id: row.id,
              title: row.title,
              subtitle: "Report",
            })),
          );
        }),
    );
  }

  await Promise.all(tasks);
  const order: SearchIndex[] = ["projects", "customers", "people", "photos", "notes", "tasks", "reports"];
  hits.sort((a, b) => order.indexOf(a.index) - order.indexOf(b.index));
  return hits.slice(0, 40);
}

export function hrefForHit(hit: SearchHit) {
  switch (hit.index) {
    case "projects":
    case "notes":
      return `/projects/${hit.id}`;
    case "photos":
      return `/projects/${hit.id}/media`;
    case "customers":
      return `/customers/${hit.id}`;
    case "people":
      return "/team";
    case "tasks":
      return `/tasks/${hit.id}`;
    case "reports":
      return `/reports/${hit.id}`;
    default:
      return "/dashboard";
  }
}
