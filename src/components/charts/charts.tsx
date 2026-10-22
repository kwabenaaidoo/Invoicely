"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMinor, toMinor } from "@/lib/money";
import { STATUS_META, type InvoiceStatusKey } from "@/lib/status";

const axis = { fontSize: 12, fill: "var(--muted-foreground)" };
const tip = { background: "var(--elevated)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "var(--shadow-md)", fontSize: 12, color: "var(--foreground)" };

const compact = (n: number, currency: string) => {
  const minor = toMinor(n, currency) ?? 0;
  return n >= 10000 ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n) : formatMinor(minor, currency).replace(/\.00$/, "");
};

type Point = { label: string; invoiced: number; paid: number; count: number };

export function RevenueChart({ data, currency, height = 280 }: { data: Point[]; currency: string; height?: number }) {
  const summary = data.map((d) => `${d.label}: invoiced ${formatMinor(toMinor(d.invoiced, currency) ?? 0, currency)}, paid ${formatMinor(toMinor(d.paid, currency) ?? 0, currency)}`).join("; ");
  return (
    <figure aria-label="Revenue by month" className="m-0">
      <div style={{ height }} role="img" aria-label={`Revenue by month. ${summary}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={3}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => compact(v, currency)} />
            <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tip} formatter={(v) => formatMinor(toMinor(Number(v), currency) ?? 0, currency)} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
            <Bar dataKey="invoiced" name="Invoiced" fill="var(--chart-neutral)" radius={[3, 3, 0, 0]} maxBarSize={22} />
            <Bar dataKey="paid" name="Paid" fill="var(--chart-lime)" radius={[3, 3, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function CountChart({ data, height = 240 }: { data: Point[]; height?: number }) {
  const summary = data.map((d) => `${d.label}: ${d.count}`).join("; ");
  return (
    <div style={{ height }} role="img" aria-label={`Invoices issued per month. ${summary}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tip} />
          <Bar dataKey="count" name="Invoices" fill="var(--chart-lime)" radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const STATUS_COLOR: Record<InvoiceStatusKey, string> = {
  DRAFT: "var(--chart-muted)",
  SENT: "var(--chart-info)",
  PENDING: "var(--chart-warning)",
  PAID: "var(--chart-lime)",
  OVERDUE: "var(--chart-danger)",
  CANCELLED: "var(--chart-neutral)",
};

export function StatusChart({ data, height = 240 }: { data: { status: InvoiceStatusKey; count: number }[]; height?: number }) {
  const rows = data.filter((d) => d.count > 0).map((d) => ({ name: STATUS_META[d.status].label, value: d.count, status: d.status }));
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (total === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No invoices to chart yet.</p>;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div style={{ height, width: height }} role="img" aria-label={`Invoice status distribution. ${rows.map((r) => `${r.name}: ${r.value}`).join("; ")}`} className="shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="var(--card)" strokeWidth={2}>
              {rows.map((r) => <Cell key={r.status} fill={STATUS_COLOR[r.status]} />)}
            </Pie>
            <Tooltip contentStyle={tip} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid w-full grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-1">
        {rows.map((r) => (
          <li key={r.status} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2"><span aria-hidden className="size-2.5 rounded-sm" style={{ background: STATUS_COLOR[r.status] }} />{r.name}</span>
            <span className="tabular font-medium">{r.value}<span className="ml-1 text-xs font-normal text-muted-foreground">({Math.round((r.value / total) * 100)}%)</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UsageChart({ data, height = 220 }: { data: { day: string; count: number; errors: number }[]; height?: number }) {
  const rows = data.map((d) => ({ ...d, label: d.day.slice(5), ok: d.count - d.errors }));
  return (
    <div style={{ height }} role="img" aria-label={`API requests per day over the last ${data.length} days`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tip} />
          <Bar dataKey="ok" name="Successful" stackId="a" fill="var(--chart-lime)" maxBarSize={14} />
          <Bar dataKey="errors" name="Errors" stackId="a" fill="var(--chart-danger)" radius={[3, 3, 0, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
