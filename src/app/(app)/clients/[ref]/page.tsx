import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { requireBusiness } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { clientTotals, getClient, serializeClient } from "@/lib/services/clients";
import { syncOverdue } from "@/lib/services/invoices";
import { toInvoiceRow } from "@/lib/services/invoice-rows";
import { formatAmount } from "@/lib/money";
import { Card, EmptyState } from "@/components/ui/card";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { ClientActions } from "@/components/clients/client-actions";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const { business } = await requireBusiness();
  const c = await getClient(business.id, ref);
  if (!c) notFound();
  await syncOverdue(business.id);
  const [invoices, totals] = await Promise.all([
    db.invoice.findMany({ where: { businessId: business.id, clientId: c.id }, orderBy: { createdAt: "desc" }, take: 50, include: { client: { select: { name: true } } } }),
    clientTotals(business.id, [c.id]),
  ]);
  const dto = serializeClient(c);
  const t = totals.get(c.id) ?? [];
  const rows = invoices.map(toInvoiceRow);

  return (
    <div className="animate-rise">
      <Link href="/clients" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />All clients</Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{dto.name}</h1>
          {dto.company ? <p className="text-sm text-muted-foreground">{dto.company}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2"><ClientActions client={dto} /></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <h2 className="text-[15px] font-semibold">Billing</h2>
            <dl className="mt-3 grid gap-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Total invoiced</dt><dd className="tabular text-xl font-semibold">{t.length ? t.map((x) => <div key={x.currency}>{formatAmount(x.invoiced, x.currency)}</div>) : "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Outstanding</dt><dd className="tabular text-xl font-semibold">{t.some((x) => x.outstanding > 0) ? t.filter((x) => x.outstanding > 0).map((x) => <div key={x.currency}>{formatAmount(x.outstanding, x.currency)}</div>) : "—"}</dd></div>
            </dl>
          </Card>
          <Card className="p-4">
            <h2 className="text-[15px] font-semibold">Details</h2>
            <dl className="mt-3 grid gap-2.5 text-sm">
              {([["Email", dto.email], ["Phone", dto.phone], ["Tax ID", dto.taxId]] as const).map(([k, v]) => (
                <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd>{v ?? "—"}</dd></div>
              ))}
              <div><dt className="text-xs text-muted-foreground">Address</dt><dd className="whitespace-pre-line">{dto.address || "—"}</dd></div>
              {dto.notes ? <div><dt className="text-xs text-muted-foreground">Notes</dt><dd className="whitespace-pre-line">{dto.notes}</dd></div> : null}
            </dl>
          </Card>
        </div>
        <section aria-labelledby="inv">
          <h2 id="inv" className="mb-3 text-base font-semibold tracking-tight">Invoices</h2>
          {rows.length === 0 ? (
            <EmptyState icon={<FileText />} title="No invoices yet" description="Invoices you create for this client will appear here." />
          ) : (
            <InvoiceTable rows={rows} caption={`Invoices for ${dto.name}`} />
          )}
        </section>
      </div>
    </div>
  );
}
