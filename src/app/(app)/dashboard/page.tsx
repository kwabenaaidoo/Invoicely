import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, CircleCheck, Clock, FileText, Plus, Wallet } from "lucide-react";
import { requireBusiness } from "@/lib/auth/dal";
import { overview } from "@/lib/services/stats";
import { listInvoices } from "@/lib/services/invoices";
import { toInvoiceRow } from "@/lib/services/invoice-rows";
import { ensureSystemTemplates } from "@/lib/services/templates";
import { formatAmount } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, PageHeader } from "@/components/ui/card";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { RevenueChart } from "@/components/charts/charts";

export const metadata: Metadata = { title: "Dashboard" };

function Stat({ label, value, hint, icon: Icon, tone = "default" }: { label: string; value: string; hint?: string; icon: typeof FileText; tone?: "default" | "good" | "warn" | "bad" }) {
  const toneCls = { default: "bg-muted text-foreground", good: "bg-accent-soft text-accent-soft-foreground", warn: "bg-warning-soft text-warning", bad: "bg-destructive-soft text-destructive" }[tone];
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <span className={`inline-flex size-8 items-center justify-center rounded-md ${toneCls}`}><Icon className="size-4" aria-hidden /></span>
      </div>
      <p className="tabular mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

export default async function DashboardPage() {
  const { user, business } = await requireBusiness();
  await ensureSystemTemplates();
  const cur = business.defaultCurrency;
  const [stats, recent] = await Promise.all([overview(business.id, cur), listInvoices(business.id, { pageSize: 6, sort: "createdAt", dir: "desc" })]);
  const rows = recent.rows.map(toInvoiceRow);

  return (
    <div className="animate-rise">
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description="Here's how your invoicing is going."
        actions={<Button asChild><Link href="/invoices/new"><Plus className="size-4" aria-hidden />New invoice</Link></Button>}
      />

      <section aria-label="Overview" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Total invoices" value={String(stats.total)} hint={`${stats.draftCount} draft`} icon={FileText} />
        <Stat label="Paid" value={String(stats.paidCount)} icon={CircleCheck} tone="good" />
        <Stat label="Pending" value={String(stats.pendingCount)} hint={formatAmount(stats.outstanding, cur) + " outstanding"} icon={Clock} tone="warn" />
        <Stat label="Overdue" value={String(stats.overdueCount)} hint={stats.overdueCount ? formatAmount(stats.overdueAmount, cur) : undefined} icon={CircleAlert} tone="bad" />
        <div className="col-span-2 lg:col-span-1"><Stat label="Total revenue" value={formatAmount(stats.revenue, cur)} hint="Paid invoices" icon={Wallet} tone="good" /></div>
      </section>
      {stats.otherCurrencies.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Figures are shown in {cur}. Invoices in {stats.otherCurrencies.join(", ")} are not included in totals.</p>
      ) : null}

      <div className="mt-6 grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
            <CardDescription>Invoiced vs paid over the last 12 months ({cur})</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.total === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Your revenue chart appears once you've sent your first invoice.</p>
            ) : (
              <RevenueChart data={stats.series} currency={cur} />
            )}
          </CardContent>
        </Card>

        <section aria-labelledby="recent">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="recent" className="text-base font-semibold tracking-tight">Recent invoices</h2>
            {rows.length > 0 ? <Link href="/invoices" className="text-sm font-medium text-link underline-offset-4 hover:underline">View all</Link> : null}
          </div>
          {rows.length === 0 ? (
            <EmptyState
              icon={<FileText />}
              title="No invoices yet"
              description="Create your first invoice in under a minute. You can customise the design and share it with a secure link."
              action={<Button asChild><Link href="/invoices/new"><Plus className="size-4" aria-hidden />Create your first invoice</Link></Button>}
            />
          ) : (
            <InvoiceTable rows={rows} caption="Recent invoices" />
          )}
        </section>
      </div>
    </div>
  );
}
