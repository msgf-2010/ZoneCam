import { requireAuth } from "@/server/auth/context";
import { CustomerEditor } from "@/components/editors";
import { PageHeader } from "@/components/ProjectRow";

export default async function NewCustomerPage() {
  const ctx = await requireAuth();
  if (!ctx.permissions.has("customers.create")) {
    return <p>You do not have permission to create customers.</p>;
  }
  return (
    <div>
      <PageHeader title="New customer" />
      <CustomerEditor />
    </div>
  );
}
