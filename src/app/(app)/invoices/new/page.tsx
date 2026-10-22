import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth/dal";
import { loadBuilderData } from "@/lib/services/builder-data";
import { newInvoiceValues } from "@/lib/invoice-form";
import { InvoiceBuilder } from "@/components/builder/invoice-builder";
import { PageHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { business } = await requireBusiness();
  const sp = await searchParams;
  const data = await loadBuilderData(business);
  const initial = newInvoiceValues(data.defaults);
  const pre = sp.client ? data.clients.find((c) => c.id === sp.client) : undefined;
  if (pre) {
    initial.clientId = pre.id;
    initial.client = { name: pre.name, company: pre.company ?? undefined, email: pre.email ?? undefined, phone: pre.phone ?? undefined, taxId: pre.taxId ?? undefined, address: pre.address || undefined };
  }
  return (
    <div className="animate-rise">
      <PageHeader title="New invoice" description="Fill in the details on the left and watch the invoice update on the right." />
      <InvoiceBuilder
        mode="create"
        status="DRAFT"
        initial={initial}
        clients={data.clients}
        products={data.products}
        templates={data.templates}
        logoUrl={data.logoUrl}
        signatureUrl={data.signatureUrl}
        nextNumber={data.nextNumber}
        taxDefault={data.defaults.taxRate}
      />
    </div>
  );
}
