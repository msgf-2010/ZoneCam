import { notFound } from "next/navigation";
import { requireAuth } from "@/server/auth/context";
import { getCustomer } from "@/server/services/customer-service";
import { CustomerEditor } from "@/components/editors";
import { PageHeader } from "@/components/ProjectRow";
import { AppError } from "@/server/http";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuth();
  if (!ctx.permissions.has("customers.edit")) {
    return <p>You do not have permission to edit customers.</p>;
  }
  let customer;
  try {
    customer = await getCustomer(ctx, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  return (
    <div>
      <PageHeader title={`Edit ${customer.name}`} />
      <CustomerEditor
        customerId={customer.id}
        initial={{
          name: customer.name,
          customerNumber: customer.customerNumber ?? "",
          email: customer.email ?? "",
          phone: customer.phone ?? "",
          addressLine1: customer.addressLine1 ?? "",
          city: customer.city ?? "",
          region: customer.region ?? "",
          postalCode: customer.postalCode ?? "",
          country: customer.country ?? "",
          notes: customer.notes ?? "",
        }}
      />
    </div>
  );
}
