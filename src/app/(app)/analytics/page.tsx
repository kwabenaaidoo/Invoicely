import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth/dal";
import { overview } from "@/lib/services/stats";
import { formatAmount } from "@/lib/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui/card";
import { CountChart, RevenueChart, StatusChart } from "@/components/charts/charts";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const { business } = await requireBusiness();
  const cur = business.defaultCurrency;
  const s = await overview(business.id, cur, 12);
  const kpis = [
    ["Total invoices", String(s.total)],
    ["Paid", String(s.paidCount)],
    ["Pending", String(s.pendingCount)],
    ["Overdue", String(s.overdueCount)],
    ["Revenue", formatAmount(s.revenue, cur)],
    ["Outstanding", formatAmount(s.outstanding, cur)],
  ];
  return (
    <div className="animate-rise">
      <PageHeader title="Analytics" description={`Last 12 months, in ${cur}.`} />
      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map(([k, v]) => (
          <Card key={k} className="p-4"><p className="text-[13px] text-muted-foreground">{k}</p><p className="tabular mt-2 text-xl font-semibold tracking-tight">{v}</p></Card>
        ))}
      </section>
      {s.otherCurrencies.length ? <p className="mt-2 text-xs text-muted-foreground">Invoices in {s.otherCurrencies.join(", ")} are excluded.</p> : null}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Revenue over time</CardTitle><CardDescription>Invoiced vs paid per month</CardDescription></CardHeader><CardContent><RevenueChart data={s.series} currency={cur} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Status distribution</CardTitle></CardHeader><CardContent><StatusChart data={s.distribution as never} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Monthly invoice count</CardTitle></CardHeader><CardContent><CountChart data={s.series} /></CardContent></Card>
      </div>
    </div>
  );
}
