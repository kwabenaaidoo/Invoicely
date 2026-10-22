import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { db } from "@/lib/db";
import { invoiceToView } from "@/lib/services/invoices";
import { ScaledInvoice } from "@/components/invoice/scaled-invoice";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";

// The token is the credential: keep it out of search engines, referrers and caches.
export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  const inv = await db.invoice.findUnique({ where: { publicToken: token }, include: { items: { orderBy: { position: "asc" } } } });
  if (!inv || inv.status === "DRAFT" || inv.status === "CANCELLED") notFound();
  const view = invoiceToView(inv);
  const balance = Math.max(0, Number(inv.total.toString()) - Number(inv.amountPaid.toString()));

  return (
    <div className="min-h-dvh bg-muted/50">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Logo />
          <ThemeToggle className="size-9" />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Invoice from {view.business.name}</p>
            <h1 className="mt-0.5 flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
              {inv.number} <StatusBadge status={inv.status} />
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {inv.status === "PAID" ? `Paid ${formatDate(inv.paidAt)}` : `${formatAmount(balance, inv.currency)} due ${formatDate(inv.dueDate)}`}
            </p>
          </div>
          <Button asChild><a href={`/api/public/${token}/pdf`} download><Download className="size-4" aria-hidden />Download PDF</a></Button>
        </div>
        <div className="overflow-hidden rounded-lg border bg-white shadow-card">
          <ScaledInvoice view={view} id="invoice-print" />
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">Created with <Link href="/" className="underline">Invoicely</Link></p>
      </main>
    </div>
  );
}
