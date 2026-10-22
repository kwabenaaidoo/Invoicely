import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth/dal";
import { getInvoiceByPublicId, invoiceToView } from "@/lib/services/invoices";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import { PrintTrigger } from "@/components/invoice/print-trigger";

export const metadata: Metadata = { title: "Print invoice", robots: { index: false } };

export default async function PrintPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const { business } = await requireBusiness();
  const inv = await getInvoiceByPublicId(business.id, ref);
  if (!inv) notFound();
  return (
    <div className="min-h-dvh bg-white print:bg-white">
      <PrintTrigger />
      <InvoiceDocument view={invoiceToView(inv)} />
    </div>
  );
}
