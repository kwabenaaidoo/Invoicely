import "server-only";
import { toDateInput } from "../utils";
import type { ClientSnapshot } from "./invoices";
import { PREFIX, toPublicId } from "./common";
import type { InvoiceRow } from "../invoice-row";

type Row = {
  publicId: string;
  number: string;
  total: { toString(): string };
  currency: string;
  issueDate: Date;
  dueDate: Date;
  status: InvoiceRow["status"];
  publicToken: string | null;
  clientSnapshot: unknown;
  client?: { name: string } | null;
};

export function toInvoiceRow(r: Row): InvoiceRow {
  return {
    ref: toPublicId(PREFIX.invoice, r.publicId),
    number: r.number,
    client: r.client?.name ?? (r.clientSnapshot as ClientSnapshot | null)?.name ?? "—",
    total: Number(r.total.toString()),
    currency: r.currency,
    issueDate: toDateInput(r.issueDate),
    dueDate: toDateInput(r.dueDate),
    status: r.status,
    shared: !!r.publicToken,
  };
}
