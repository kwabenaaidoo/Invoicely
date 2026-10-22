import { z } from "zod";
import { invoiceItemSchema, invoiceSchema } from "./validators";
import { DEFAULT_DESIGN, type Design } from "./design";
import type { InvoiceView } from "./invoice-view";
import { addDays, toDateInput, todayUtc } from "./utils";

/**
 * Client-side form schema. Identical rules to the server schema, except that the browser
 * works with public ids (`cli_…`, `prod_…`) which the server action maps to internal ids.
 */
export const invoiceFormSchema = invoiceSchema.extend({
  clientId: z.string().max(80).nullish(),
  templateId: z.string().max(80).nullish(),
  items: z.array(invoiceItemSchema.extend({ productId: z.string().max(80).nullish() })).min(1, "Add at least one item").max(200),
});
export type InvoiceFormValues = z.input<typeof invoiceFormSchema>;

export type BuilderDefaults = {
  business: { name: string; email?: string; phone?: string; website?: string; taxId?: string; address?: string; paymentInfo?: string };
  currency: string;
  paymentTerms: number;
  taxRate: number;
  notes?: string;
  footer?: string;
  design: Design;
  templateId: string | null;
};

export function newInvoiceValues(d: BuilderDefaults): InvoiceFormValues {
  const issue = todayUtc();
  return {
    clientId: null,
    saveClient: true,
    templateId: d.templateId,
    number: "",
    reference: "",
    issueDate: toDateInput(issue),
    dueDate: toDateInput(addDays(issue, d.paymentTerms)),
    paymentTerms: d.paymentTerms,
    currency: d.currency as InvoiceFormValues["currency"],
    discountType: "PERCENT",
    discountValue: 0,
    shipping: 0,
    notes: d.notes ?? "",
    terms: "",
    business: { ...d.business },
    client: { name: "" },
    design: { ...DEFAULT_DESIGN, ...d.design, footerText: d.design.footerText || d.footer || "" },
    items: [{ productId: null, description: "", quantity: 1, unitPrice: 0, taxRate: d.taxRate, discountRate: 0 }],
  };
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Preview data from (possibly half-typed) form values. Never throws. */
export function valuesToView(v: Partial<InvoiceFormValues>, extra: { status?: InvoiceView["status"]; logoUrl?: string | null; signatureUrl?: string | null; amountPaid?: number } = {}): InvoiceView {
  const biz = v.business ?? { name: "" };
  const client = v.client ?? { name: "" };
  return {
    number: v.number?.trim() || "AUTO",
    reference: v.reference,
    status: extra.status ?? "DRAFT",
    issueDate: v.issueDate ?? "",
    dueDate: v.dueDate ?? "",
    paymentTerms: n(v.paymentTerms),
    currency: v.currency ?? "USD",
    business: { ...biz, name: biz.name || "Your business", logoUrl: extra.logoUrl, signatureUrl: extra.signatureUrl },
    client: { ...client, name: client.name ?? "" },
    items: (v.items ?? []).map((i) => ({ description: i?.description ?? "", quantity: n(i?.quantity), unitPrice: n(i?.unitPrice), taxRate: n(i?.taxRate), discountRate: n(i?.discountRate) })),
    discountType: v.discountType ?? "PERCENT",
    discountValue: n(v.discountValue),
    shipping: n(v.shipping),
    amountPaid: extra.amountPaid ?? 0,
    notes: v.notes,
    terms: v.terms,
    design: { ...DEFAULT_DESIGN, ...(v.design as Partial<Design> | undefined), show: { ...DEFAULT_DESIGN.show, ...(v.design?.show ?? {}) } },
  };
}
