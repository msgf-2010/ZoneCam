import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/server/auth/context";
import { getCustomer } from "@/server/services/customer-service";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader, ProjectStatusChip } from "@/components/ProjectRow";
import { formatAddress } from "@/lib/format";
import { AppError } from "@/server/http";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuth();
  let customer;
  try {
    customer = await getCustomer(ctx, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const canEdit = ctx.permissions.has("customers.edit");

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description={customer.customerNumber ?? undefined}
        action={
          canEdit ? (
            <Link href={`/customers/${customer.id}/edit`}>
              <Button variant="secondary">Edit</Button>
            </Link>
          ) : null
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Details">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[var(--muted)]">Email</dt>
              <dd>{customer.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Phone</dt>
              <dd>{customer.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Address</dt>
              <dd>{formatAddress(customer) || "—"}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Contacts">
          {customer.contacts.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No contacts yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {customer.contacts.map((c) => (
                <li key={c.id}>
                  {c.firstName} {c.lastName}
                  {c.isPrimary ? " · Primary" : ""}
                  <div className="text-[var(--muted)]">{c.email || c.phone}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card title="Jobs">
        {customer.projects.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No jobs for this customer.</p>
        ) : (
          <ul>
            {customer.projects.map((project) => (
              <li key={project.id} className="flex items-center justify-between border-b border-[var(--line)] py-3">
                <Link href={`/projects/${project.id}`}>
                  {project.number} · {project.name}
                </Link>
                <ProjectStatusChip name={project.projectStatus.name} color={project.projectStatus.color} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
