import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { RowActions } from "./row-actions";
import { formatAmount } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import type { InvoiceRow } from "@/lib/invoice-row";

/** Table from `md` up, stacked cards below it: no horizontal scrolling on phones. */
export function InvoiceTable({ rows, caption }: { rows: InvoiceRow[]; caption: string }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Invoice</th>
              <th scope="col" className="px-4 py-3 font-medium">Client</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
              <th scope="col" className="px-4 py-3 font-medium">Issued</th>
              <th scope="col" className="px-4 py-3 font-medium">Due</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="w-12 px-2 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.ref} className="transition-colors hover:bg-muted/40">
                <td className="px-4 py-3 font-medium"><Link href={`/invoices/${r.ref}`} className="text-foreground underline-offset-4 hover:underline">{r.number}</Link></td>
                <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground">{r.client}</td>
                <td className="tabular px-4 py-3 text-right font-medium">{formatAmount(r.total, r.currency)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(r.issueDate)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(r.dueDate)}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-2 py-2"><RowActions refId={r.ref} number={r.number} status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 md:hidden" aria-label={caption}>
        {rows.map((r) => (
          <li key={r.ref} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/invoices/${r.ref}`} className="font-semibold underline-offset-4 hover:underline">{r.number}</Link>
                <p className="truncate text-sm text-muted-foreground">{r.client}</p>
              </div>
              <RowActions refId={r.ref} number={r.number} status={r.status} />
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="tabular text-lg font-semibold">{formatAmount(r.total, r.currency)}</p>
                <p className="text-xs text-muted-foreground">Due {formatDate(r.dueDate)}</p>
              </div>
              <StatusBadge status={r.status} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
