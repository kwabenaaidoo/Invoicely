import type { Metadata } from "next";
import Link from "next/link";
import { FileSearch, FileText, Plus } from "lucide-react";
import { requireBusiness } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { listInvoices, type ListFilters } from "@/lib/services/invoices";
import { toInvoiceRow } from "@/lib/services/invoice-rows";
import { PREFIX, fromPublicId, toPublicId } from "@/lib/services/common";
import { INVOICE_STATUSES } from "@/lib/status";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { InvoiceFilters } from "@/components/invoices/filters";
import { InvoiceTable } from "@/components/invoices/invoice-table";

export const metadata: Metadata = { title: "Invoices" };

type SP = { q?: string; status?: string; client?: string; from?: string; to?: string; sort?: string; dir?: string; page?: string };
const SORTS = ["number", "issueDate", "dueDate", "total", "status", "createdAt"] as const;
const date = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { business } = await requireBusiness();

  let clientId: string | undefined;
  if (sp.client) {
    const pid = fromPublicId(PREFIX.client, sp.client);
    clientId = pid ? (await db.client.findFirst({ where: { publicId: pid, businessId: business.id }, select: { id: true } }))?.id : undefined;
  }
  const filters: ListFilters = {
    q: sp.q?.slice(0, 100),
    status: INVOICE_STATUSES.find((s) => s === sp.status),
    clientId,
    from: date(sp.from),
    to: date(sp.to),
    sort: SORTS.find((s) => s === sp.sort),
    dir: sp.dir === "asc" ? "asc" : "desc",
    page: Math.max(1, Number(sp.page) || 1),
    pageSize: 15,
  };
  const [result, clients, anyInvoice] = await Promise.all([
    listInvoices(business.id, filters),
    db.client.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" }, take: 200, select: { publicId: true, name: true } }),
    db.invoice.count({ where: { businessId: business.id }, take: 1 }),
  ]);
  const rows = result.rows.map(toInvoiceRow);
  const filtered = !!(sp.q || sp.status || sp.client || sp.from || sp.to);

  return (
    <div className="animate-rise">
      <PageHeader title="Invoices" description="Search, filter and manage every invoice." actions={<Button asChild><Link href="/invoices/new"><Plus className="size-4" aria-hidden />New invoice</Link></Button>} />
      {anyInvoice === 0 ? (
        <EmptyState icon={<FileText />} title="No invoices yet" description="Create your first invoice and it will show up here." action={<Button asChild><Link href="/invoices/new"><Plus className="size-4" aria-hidden />Create invoice</Link></Button>} />
      ) : (
        <>
          <InvoiceFilters clients={clients.map((c) => ({ id: toPublicId(PREFIX.client, c.publicId), name: c.name }))} />
          {rows.length === 0 ? (
            <EmptyState icon={<FileSearch />} title="No invoices match your filters" description={filtered ? "Try a different search or clear the filters." : undefined} action={<Button asChild variant="outline"><Link href="/invoices">Clear filters</Link></Button>} />
          ) : (
            <>
              <InvoiceTable rows={rows} caption="Invoices" />
              <Pagination page={result.page} pages={result.pages} total={result.total} pageSize={result.pageSize} basePath="/invoices" params={{ q: sp.q, status: sp.status, client: sp.client, from: sp.from, to: sp.to, sort: sp.sort, dir: sp.dir }} />
            </>
          )}
        </>
      )}
    </div>
  );
}
