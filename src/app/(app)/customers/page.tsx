import Link from "next/link";
import { requireAuth } from "@/server/auth/context";
import { listCustomers } from "@/server/services/customer-service";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ProjectRow";

export default async function CustomersPage() {
  const ctx = await requireAuth();
  if (!ctx.permissions.has("customers.view")) {
    return <p>You do not have permission to view customers.</p>;
  }
  const customers = await listCustomers(ctx);
  const canCreate = ctx.permissions.has("customers.create");

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Accounts this company works for."
        action={
          canCreate ? (
            <Link href="/customers/new">
              <Button>New customer</Button>
            </Link>
          ) : null
        }
      />
      {customers.length === 0 ? (
        <EmptyState title="No customers yet" body="Add a customer before you create jobs for them." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[#fafafa] text-[var(--muted)]">
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Contact</th>
                  <th className="py-2 font-medium">Jobs</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const primary = customer.contacts[0];
                  return (
                    <tr key={customer.id} className="border-b border-[var(--line)]">
                      <td className="py-3">
                        <Link href={`/customers/${customer.id}`} className="font-medium">
                          {customer.name}
                        </Link>
                        <div className="text-[var(--muted)]">{customer.customerNumber}</div>
                      </td>
                      <td className="py-3">
                        {primary ? `${primary.firstName} ${primary.lastName}` : "—"}
                        <div className="text-[var(--muted)]">{customer.phone || customer.email || ""}</div>
                      </td>
                      <td className="py-3">{customer._count.projects}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
