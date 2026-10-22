import type { InvoiceStatusKey } from "./status";

/** Serializable shape used by list pages and the row actions menu. */
export type InvoiceRow = {
  ref: string;
  number: string;
  client: string;
  total: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatusKey;
  shared: boolean;
};
