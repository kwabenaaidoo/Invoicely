"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { INVOICE_STATUSES, STATUS_META } from "@/lib/status";

const SORTS = [
  { v: "createdAt:desc", l: "Newest first" },
  { v: "createdAt:asc", l: "Oldest first" },
  { v: "dueDate:asc", l: "Due date (soonest)" },
  { v: "dueDate:desc", l: "Due date (latest)" },
  { v: "total:desc", l: "Amount (high to low)" },
  { v: "total:asc", l: "Amount (low to high)" },
  { v: "number:asc", l: "Invoice number" },
];

/** Filter state lives in the URL, so views are shareable and the back button works. Search is debounced. */
export function InvoiceFilters({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = React.useState(sp.get("q") ?? "");
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  const push = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, router, pathname],
  );

  React.useEffect(() => () => clearTimeout(timer.current), []);
  const sort = `${sp.get("sort") ?? "createdAt"}:${sp.get("dir") ?? "desc"}`;
  const active = ["q", "status", "client", "from", "to"].some((k) => sp.get(k));

  return (
    <form role="search" aria-label="Filter invoices" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))]" onSubmit={(e) => e.preventDefault()}>
      <div className="relative sm:col-span-2 lg:col-span-1">
        <label htmlFor="f-q" className="sr-only">Search invoices</label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="f-q"
          type="search"
          className="pl-9"
          placeholder="Search number, client, reference…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => push({ q: e.target.value.trim() || null }), 300);
          }}
        />
      </div>
      <div>
        <label htmlFor="f-status" className="sr-only">Status</label>
        <Select id="f-status" value={sp.get("status") ?? ""} onChange={(e) => push({ status: e.target.value || null })}>
          <option value="">All statuses</option>
          {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </Select>
      </div>
      <div>
        <label htmlFor="f-client" className="sr-only">Client</label>
        <Select id="f-client" value={sp.get("client") ?? ""} onChange={(e) => push({ client: e.target.value || null })}>
          <option value="">All clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      <div>
        <label htmlFor="f-from" className="sr-only">Issued from</label>
        <Input id="f-from" type="date" aria-label="Issued from" title="Issued from" value={sp.get("from") ?? ""} onChange={(e) => push({ from: e.target.value || null })} />
      </div>
      <div>
        <label htmlFor="f-to" className="sr-only">Issued to</label>
        <Input id="f-to" type="date" aria-label="Issued to" title="Issued to" value={sp.get("to") ?? ""} onChange={(e) => push({ to: e.target.value || null })} />
      </div>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="f-sort" className="sr-only">Sort by</label>
          <Select
            id="f-sort"
            value={sort}
            onChange={(e) => {
              const [s, d] = e.target.value.split(":");
              push({ sort: s === "createdAt" && d === "desc" ? null : s!, dir: s === "createdAt" && d === "desc" ? null : d! });
            }}
          >
            {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </Select>
        </div>
        {active ? (
          <Button type="button" variant="outline" size="icon" aria-label="Clear filters" onClick={() => { setQ(""); router.replace(pathname); }}><X className="size-4" /></Button>
        ) : null}
      </div>
    </form>
  );
}
