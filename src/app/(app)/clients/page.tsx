import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requireBusiness } from "@/lib/auth/dal";
import { clientTotals, listClients, serializeClient } from "@/lib/services/clients";
import { formatAmount } from "@/lib/money";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { SearchForm } from "@/components/ui/search-form";
import { AddClientButton } from "@/components/clients/client-form";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const { business } = await requireBusiness();
  const res = await listClients(business.id, { q: sp.q?.slice(0, 100), page: Math.max(1, Number(sp.page) || 1), pageSize: 20 });
  const totals = await clientTotals(business.id, res.rows.map((r) => r.id));
  const rows = res.rows.map((r) => ({ ...serializeClient(r), totals: totals.get(r.id) ?? [] }));

  return (
    <div className="animate-rise">
      <PageHeader title="Clients" description="Everyone you invoice, with what they've been billed and what they owe." actions={<AddClientButton />} />
      {rows.length === 0 && !sp.q ? (
        <EmptyState icon={<Users />} title="No clients found" description="Add a client to reuse their details on every invoice." action={<AddClientButton />} />
      ) : (
        <>
          <SearchForm action="/clients" q={sp.q} placeholder="Search clients…" label="Search clients" />
          {rows.length === 0 ? (
            <EmptyState icon={<Users />} title="No clients found" description={`Nothing matches “${sp.q}”.`} />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
                <table className="w-full text-sm">
                  <caption className="sr-only">Clients</caption>
                  <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Client</th>
                      <th scope="col" className="px-4 py-3 font-medium">Email</th>
                      <th scope="col" className="px-4 py-3 font-medium">Country</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Invoiced</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <Link href={`/clients/${c.id}`} className="font-medium underline-offset-4 hover:underline">{c.name}</Link>
                          {c.company ? <div className="text-xs text-muted-foreground">{c.company}</div> : null}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.country ?? "—"}</td>
                        <td className="tabular px-4 py-3 text-right">{c.totals.length ? c.totals.map((t) => <div key={t.currency}>{formatAmount(t.invoiced, t.currency)}</div>) : "—"}</td>
                        <td className="tabular px-4 py-3 text-right font-medium">{c.totals.some((t) => t.outstanding > 0) ? c.totals.filter((t) => t.outstanding > 0).map((t) => <div key={t.currency}>{formatAmount(t.outstanding, t.currency)}</div>) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="flex flex-col gap-3 md:hidden" aria-label="Clients">
                {rows.map((c) => (
                  <li key={c.id} className="rounded-lg border bg-card p-4">
                    <Link href={`/clients/${c.id}`} className="font-semibold underline-offset-4 hover:underline">{c.name}</Link>
                    <p className="text-sm text-muted-foreground">{c.company ?? c.email ?? "—"}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div><dt className="text-xs text-muted-foreground">Invoiced</dt><dd className="tabular">{c.totals.length ? c.totals.map((t) => <div key={t.currency}>{formatAmount(t.invoiced, t.currency)}</div>) : "—"}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">Outstanding</dt><dd className="tabular font-medium">{c.totals.some((t) => t.outstanding > 0) ? c.totals.filter((t) => t.outstanding > 0).map((t) => <div key={t.currency}>{formatAmount(t.outstanding, t.currency)}</div>) : "—"}</dd></div>
                    </dl>
                  </li>
                ))}
              </ul>
              <Pagination page={res.page} pages={res.pages} total={res.total} pageSize={res.pageSize} basePath="/clients" params={{ q: sp.q }} />
            </>
          )}
        </>
      )}
    </div>
  );
}
