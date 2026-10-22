import "server-only";
import { db } from "../db";
import { todayUtc } from "../utils";
import { syncOverdue } from "./invoices";

export type Series = { month: string; label: string; count: number; invoiced: number; paid: number };

function lastMonths(n: number) {
  const out: { key: string; label: string }[] = [];
  const now = todayUtc();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" }) });
  }
  return out;
}

/** Aggregates are computed in SQL against the (businessId, status) / (businessId, issueDate) indexes. */
export async function overview(businessId: string, currency: string, months = 12) {
  await syncOverdue(businessId);
  const monthsList = lastMonths(months);
  const from = new Date(`${monthsList[0]!.key}-01T00:00:00.000Z`);

  const [byStatus, monthly, currencies] = await Promise.all([
    db.invoice.groupBy({ by: ["status"], where: { businessId, currency }, _count: { _all: true }, _sum: { total: true, amountPaid: true } }),
    db.$queryRaw<{ month: string; count: number; invoiced: number; paid: number }[]>`
      SELECT to_char(date_trunc('month', "issueDate"), 'YYYY-MM') AS month,
             count(*)::int AS count,
             COALESCE(sum("total") FILTER (WHERE "status" NOT IN ('DRAFT','CANCELLED')), 0)::float8 AS invoiced,
             COALESCE(sum("total") FILTER (WHERE "status" = 'PAID'), 0)::float8 AS paid
      FROM "Invoice"
      WHERE "businessId" = ${businessId}::uuid AND "currency" = ${currency} AND "issueDate" >= ${from}
      GROUP BY 1 ORDER BY 1`,
    db.invoice.groupBy({ by: ["currency"], where: { businessId }, _count: { _all: true } }),
  ]);

  const count = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
  const sum = (s: string) => Number(byStatus.find((r) => r.status === s)?._sum.total ?? 0);
  const paid = sum("PAID");
  const outstanding = sum("SENT") + sum("PENDING") + sum("OVERDUE");
  const map = new Map(monthly.map((m) => [m.month, m]));
  const series: Series[] = monthsList.map((m) => ({ month: m.key, label: m.label, count: map.get(m.key)?.count ?? 0, invoiced: map.get(m.key)?.invoiced ?? 0, paid: map.get(m.key)?.paid ?? 0 }));

  return {
    currency,
    total: byStatus.reduce((a, r) => a + r._count._all, 0),
    paidCount: count("PAID"),
    pendingCount: count("PENDING") + count("SENT"),
    overdueCount: count("OVERDUE"),
    draftCount: count("DRAFT"),
    cancelledCount: count("CANCELLED"),
    revenue: paid,
    outstanding,
    overdueAmount: sum("OVERDUE"),
    distribution: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
    series,
    otherCurrencies: currencies.filter((c) => c.currency !== currency).map((c) => c.currency),
  };
}
