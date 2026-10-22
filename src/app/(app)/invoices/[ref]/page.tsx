import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireBusiness } from "@/lib/auth/dal";
import { getInvoiceByPublicId, invoiceToView, publicInvoiceUrl, syncOverdue } from "@/lib/services/invoices";
import { formatAmount } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ScaledInvoice } from "@/components/invoice/scaled-invoice";
import { DetailActions } from "@/components/invoices/detail-actions";
import type { ClientSnapshot } from "@/lib/services/invoices";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const { business } = await requireBusiness();
  await syncOverdue(business.id);
  const inv = await getInvoiceByPublicId(business.id, ref);
  if (!inv) notFound();
  const view = invoiceToView(inv);
  const client = inv.clientSnapshot as ClientSnapshot;
  const balance = Number(inv.total.toString()) - Number(inv.amountPaid.toString());

  const timeline = [
    { label: "Created", at: inv.createdAt },
    inv.sentAt ? { label: "Sent", at: inv.sentAt } : null,
    inv.publicShareAt ? { label: "Link shared", at: inv.publicShareAt } : null,
    inv.paidAt ? { label: "Paid", at: inv.paidAt } : null,
    inv.cancelledAt ? { label: "Cancelled", at: inv.cancelledAt } : null,
  ].filter(Boolean) as { label: string; at: Date }[];

  return (
    <div className="animate-rise">
      <Link href="/invoices" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />All invoices</Link>
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{inv.number}</h1>
          <StatusBadge status={inv.status} />
        </div>
        <DetailActions refId={ref} number={inv.number} status={inv.status} shareUrl={inv.publicToken ? publicInvoiceUrl(inv.publicToken) : null} hasClientEmail={!!client.email} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-lg border bg-white shadow-card">
          <ScaledInvoice view={view} id="invoice-detail" />
        </div>
        <aside className="flex flex-col gap-4" aria-label="Invoice summary">
          <Card className="p-4">
            <h2 className="text-[15px] font-semibold">Summary</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Client</dt><dd className="min-w-0 truncate text-right font-medium">{client.name}</dd>
              <dt className="text-muted-foreground">Issued</dt><dd className="text-right">{formatDate(inv.issueDate)}</dd>
              <dt className="text-muted-foreground">Due</dt><dd className="text-right">{formatDate(inv.dueDate)}</dd>
              <dt className="text-muted-foreground">Total</dt><dd className="tabular text-right font-semibold">{formatAmount(inv.total, inv.currency)}</dd>
              <dt className="text-muted-foreground">Paid</dt><dd className="tabular text-right">{formatAmount(inv.amountPaid, inv.currency)}</dd>
              <dt className="text-muted-foreground">Balance due</dt><dd className="tabular text-right font-semibold">{formatAmount(Math.max(0, balance), inv.currency)}</dd>
            </dl>
          </Card>
          <Card className="p-4">
            <h2 className="text-[15px] font-semibold">Activity</h2>
            <ol className="mt-3 flex flex-col gap-2.5 border-l pl-4">
              {timeline.map((t) => (
                <li key={t.label} className="relative text-sm">
                  <span aria-hidden className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary ring-4 ring-card" />
                  <span className="font-medium">{t.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{formatDate(t.at)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
    </div>
  );
}
