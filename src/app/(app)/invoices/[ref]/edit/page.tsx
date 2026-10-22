import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth/dal";
import { loadBuilderData, productPublicIds } from "@/lib/services/builder-data";
import { getInvoiceByPublicId } from "@/lib/services/invoices";
import { PREFIX, toPublicId } from "@/lib/services/common";
import { designSchema, DEFAULT_DESIGN } from "@/lib/design";
import { toDateInput } from "@/lib/utils";
import { assetUrl } from "@/lib/storage";
import type { InvoiceFormValues } from "@/lib/invoice-form";
import type { BusinessSnapshot, ClientSnapshot } from "@/lib/services/invoices";
import { InvoiceBuilder } from "@/components/builder/invoice-builder";
import { PageHeader } from "@/components/ui/card";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const { business } = await requireBusiness();
  const inv = await getInvoiceByPublicId(business.id, ref);
  if (!inv) notFound();
  if (inv.status === "PAID" || inv.status === "CANCELLED") redirect(`/invoices/${ref}`);

  const data = await loadBuilderData(business);
  const prodRefs = await productPublicIds(business.id, inv.items.map((i) => i.productId).filter((x): x is string => !!x));
  const client = inv.clientId ? await db.client.findUnique({ where: { id: inv.clientId }, select: { publicId: true } }) : null;
  const b = inv.businessSnapshot as BusinessSnapshot;
  const c = inv.clientSnapshot as ClientSnapshot;
  const parsed = designSchema.safeParse(inv.design);

  const initial: InvoiceFormValues = {
    clientId: client ? toPublicId(PREFIX.client, client.publicId) : null,
    saveClient: false,
    templateId: inv.templateId,
    number: inv.number,
    reference: inv.reference ?? "",
    issueDate: toDateInput(inv.issueDate),
    dueDate: toDateInput(inv.dueDate),
    paymentTerms: inv.paymentTerms,
    currency: inv.currency as InvoiceFormValues["currency"],
    discountType: inv.discountType,
    discountValue: Number(inv.discountValue.toString()),
    shipping: Number(inv.shipping.toString()),
    notes: inv.notes ?? "",
    terms: inv.terms ?? "",
    business: { name: b.name, email: b.email, phone: b.phone, website: b.website, taxId: b.taxId, address: b.address, paymentInfo: b.paymentInfo },
    client: { name: c.name, company: c.company, email: c.email, phone: c.phone, taxId: c.taxId, address: c.address },
    design: parsed.success ? parsed.data : DEFAULT_DESIGN,
    items: inv.items.map((i) => ({
      productId: i.productId ? (prodRefs.get(i.productId) ?? null) : null,
      description: i.description,
      quantity: Number(i.quantity.toString()),
      unitPrice: Number(i.unitPrice.toString()),
      taxRate: Number(i.taxRate.toString()),
      discountRate: Number(i.discountRate.toString()),
    })),
  };

  return (
    <div className="animate-rise">
      <PageHeader title={`Edit ${inv.number}`} description="Changes update the invoice and its share link immediately." />
      <InvoiceBuilder
        mode="edit"
        invoiceRef={ref}
        status={inv.status}
        initial={initial}
        clients={data.clients}
        products={data.products}
        templates={data.templates}
        logoUrl={assetUrl(b.logoKey) ?? data.logoUrl}
        signatureUrl={assetUrl(b.signatureKey) ?? data.signatureUrl}
        nextNumber={data.nextNumber}
        taxDefault={data.defaults.taxRate}
      />
    </div>
  );
}
