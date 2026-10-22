import type { Metadata } from "next";
import { Activity } from "lucide-react";
import { requireBusiness } from "@/lib/auth/dal";
import { apiUsage } from "@/lib/services/developer";
import { AccessGate } from "@/components/developer/access-gate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from "@/components/ui/card";
import { UsageChart } from "@/components/charts/charts";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "API Usage" };

export default async function UsagePage() {
  const { user } = await requireBusiness();
  if (user.role === "USER") return <AccessGate />;
  const u = await apiUsage(user.id, 30);
  if (u.total === 0) return <EmptyState icon={<Activity />} title="No API requests yet" description="Requests made with your keys over the last 30 days will show up here." />;
  const rate = u.total ? Math.round((u.errors / u.total) * 1000) / 10 : 0;
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-3 gap-3">
        {[["Requests (30d)", u.total.toLocaleString()], ["Errors", u.errors.toLocaleString()], ["Error rate", `${rate}%`]].map(([k, v]) => <Card key={k} className="p-4"><p className="text-[13px] text-muted-foreground">{k}</p><p className="tabular mt-2 text-xl font-semibold">{v}</p></Card>)}
      </div>
      <Card><CardHeader><CardTitle>Requests per day</CardTitle><CardDescription>Last 30 days</CardDescription></CardHeader><CardContent><UsageChart data={u.series} /></CardContent></Card>
      <Card>
        <CardHeader><CardTitle>Recent requests</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Recent API requests</caption>
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th scope="col" className="py-2 pr-3 font-medium">When</th><th scope="col" className="py-2 pr-3 font-medium">Request</th><th scope="col" className="py-2 pr-3 font-medium">Status</th><th scope="col" className="py-2 pr-3 text-right font-medium">Time</th><th scope="col" className="py-2 font-medium">Key</th></tr></thead>
            <tbody className="divide-y">
              {u.recent.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap py-2 pr-3 text-muted-foreground">{formatDate(r.at, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}</td>
                  <td className="py-2 pr-3 font-mono text-xs"><span className="font-semibold">{r.method}</span> {r.path}</td>
                  <td className="py-2 pr-3"><span className={`font-medium ${r.status >= 400 ? "text-destructive" : "text-success"}`}>{r.status >= 400 ? "✕ " : "✓ "}{r.status}</span></td>
                  <td className="tabular py-2 pr-3 text-right text-muted-foreground">{r.ms} ms</td>
                  <td className="py-2 text-muted-foreground">{r.key}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
