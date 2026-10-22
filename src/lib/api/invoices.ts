import "server-only";
import { z } from "zod";
import type { Business } from "@/generated/prisma/client";
import { db } from "../db";
import { DEFAULT_DESIGN, designSchema, type Design } from "../design";
import { invoiceItemSchema, invoiceSchema, optionalEmail, optionalText, text, type InvoiceFormOutput } from "../validators";
import { CURRENCY_CODES } from "../money";
import { addDays, parseDateInput, toDateInput, todayUtc } from "../utils";
import { API_STATUS } from "../status";
import { PREFIX, ServiceError, fromPublicId, toPublicId } from "../services/common";
import { businessToSnapshot, clientToSnapshot, formatAddress, publicInvoiceUrl, type InvoiceWithRelations, type BusinessSnapshot, type ClientSnapshot } from "../services/invoices";
import { zodDetails } from "./handler";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const apiInvoiceBody = z
  .object({
    clientId: z.string().max(80).optional(),
    client: z.object({ name: text(120, 1), company: optionalText(120), email: optionalEmail, phone: optionalText(40), taxId: optionalText(60), address: optionalText(500) }).strict().optional(),
    saveClient: z.boolean().optional(),
    templateId: z.uuid().optional(),
    number: optionalText(40),
    reference: optionalText(80),
    issueDate: dateStr.optional(),
    dueDate: dateStr.optional(),
    paymentTerms: z.number().int().min(0).max(365).optional(),
    currency: z.enum(CURRENCY_CODES).optional(),
    discountType: z.enum(["PERCENT", "FIXED"]).optional(),
    discountValue: z.number().min(0).max(1_000_000_000).optional(),
    shipping: z.number().min(0).max(1_000_000_000).optional(),
    notes: optionalText(2000),
    terms: optionalText(2000),
    design: designSchema.partial().optional(),
    items: z.array(invoiceItemSchema.omit({ productId: true }).extend({ productId: z.string().max(80).nullish() })).min(1, "Add at least one item").max(200).optional(),
    status: z.enum(["draft", "sent", "pending", "paid", "overdue", "cancelled"]).optional(),
  })
  .strict();
export type ApiInvoiceBody = z.infer<typeof apiInvoiceBody>;

/** Turn a friendly API body into the exact shape the shared invoice service validates and stores. */
export async function buildInvoiceInput(business: Business, body: ApiInvoiceBody, existing?: InvoiceWithRelations): Promise<InvoiceFormOutput> {
  const base = existing
    ? {
        biz: existing.businessSnapshot as BusinessSnapshot,
        cli: existing.clientSnapshot as ClientSnapshot,
        issue: toDateInput(existing.issueDate),
        terms: existing.paymentTerms,
        dueDate: toDateInput(existing.dueDate),
        currency: existing.currency,
        design: designSchema.catch(DEFAULT_DESIGN).parse(existing.design),
      }
    : null;

  let client: ClientSnapshot | undefined = base?.cli;
  let clientId: string | null = existing?.clientId ?? null;
  if (body.clientId) {
    const pid = fromPublicId(PREFIX.client, body.clientId);
    const c = pid ? await db.client.findFirst({ where: { publicId: pid, businessId: business.id } }) : null;
    if (!c) throw new ServiceError("NOT_FOUND", "Client not found", [{ path: "clientId", message: "No client with this id" }]);
    client = clientToSnapshot(c);
    clientId = c.id;
  } else if (body.client) {
    client = body.client as ClientSnapshot;
    clientId = null;
  }
  if (!client) throw new ServiceError("VALIDATION_ERROR", "Provide either clientId or client", [{ path: "client", message: "clientId or client is required" }]);

  const issue = body.issueDate ?? base?.issue ?? toDateInput(todayUtc());
  const terms = body.paymentTerms ?? base?.terms ?? business.defaultPaymentTerms;
  const due = body.dueDate ?? (body.issueDate || body.paymentTerms !== undefined || !base ? toDateInput(addDays(parseDateInput(issue), terms)) : base.dueDate);

  let tplDesign: Design = base?.design ?? DEFAULT_DESIGN;
  if (!base) {
    const tpl = business.defaultTemplateId ? await db.invoiceTemplate.findFirst({ where: { id: business.defaultTemplateId } }) : null;
    const parsed = tpl ? designSchema.safeParse(tpl.config) : null;
    if (parsed?.success) tplDesign = parsed.data;
  }
  const design = designSchema.parse({ ...tplDesign, ...(body.design ?? {}), show: { ...tplDesign.show, ...(body.design?.show ?? {}) }, footerText: body.design?.footerText ?? tplDesign.footerText ?? business.defaultFooter ?? "" });

  // Map product public ids to internal ids inside this business.
  const items = body.items
    ? await Promise.all(
        body.items.map(async (it) => {
          let productId: string | null = null;
          if (it.productId) {
            const pid = fromPublicId(PREFIX.product, it.productId);
            const p = pid ? await db.product.findFirst({ where: { publicId: pid, businessId: business.id }, select: { id: true } }) : null;
            if (!p) throw new ServiceError("NOT_FOUND", "Product not found", [{ path: "items.productId", message: "No product with this id" }]);
            productId = p.id;
          }
          return { ...it, productId, taxRate: it.taxRate ?? Number(business.defaultTaxRate.toString()) };
        }),
      )
    : existing!.items.map((i) => ({ productId: i.productId, description: i.description, quantity: Number(i.quantity.toString()), unitPrice: Number(i.unitPrice.toString()), taxRate: Number(i.taxRate.toString()), discountRate: Number(i.discountRate.toString()) }));

  const bizSnap = base?.biz ?? businessToSnapshot(business);
  const candidate = {
    clientId,
    saveClient: body.saveClient ?? false,
    templateId: body.templateId ?? existing?.templateId ?? business.defaultTemplateId ?? null,
    number: body.number ?? (existing ? existing.number : undefined),
    reference: body.reference ?? existing?.reference ?? undefined,
    issueDate: issue,
    dueDate: due,
    paymentTerms: terms,
    currency: body.currency ?? base?.currency ?? business.defaultCurrency,
    discountType: body.discountType ?? existing?.discountType ?? "PERCENT",
    discountValue: body.discountValue ?? (existing ? Number(existing.discountValue.toString()) : 0),
    shipping: body.shipping ?? (existing ? Number(existing.shipping.toString()) : 0),
    notes: body.notes ?? existing?.notes ?? business.defaultNotes ?? undefined,
    terms: body.terms ?? existing?.terms ?? undefined,
    business: { name: bizSnap.name, email: bizSnap.email, phone: bizSnap.phone, website: bizSnap.website, taxId: bizSnap.taxId, address: bizSnap.address ?? (formatAddress(business) || undefined), paymentInfo: bizSnap.paymentInfo },
    client,
    design,
    items,
  };
  const parsed = invoiceSchema.safeParse(candidate);
  if (!parsed.success) throw new ServiceError("VALIDATION_ERROR", "Invalid invoice data", zodDetails(parsed.error));
  return parsed.data;
}

export function serializeInvoice(inv: InvoiceWithRelations) {
  const client = inv.clientSnapshot as ClientSnapshot;
  return {
    id: toPublicId(PREFIX.invoice, inv.publicId),
    invoiceNumber: inv.number,
    reference: inv.reference,
    status: API_STATUS[inv.status],
    currency: inv.currency,
    issueDate: toDateInput(inv.issueDate),
    dueDate: toDateInput(inv.dueDate),
    paymentTerms: inv.paymentTerms,
    client: { id: inv.client ? toPublicId(PREFIX.client, inv.client.publicId) : null, name: client.name, company: client.company ?? null, email: client.email ?? null },
    items: inv.items.map((i) => ({ description: i.description, quantity: Number(i.quantity.toString()), unitPrice: Number(i.unitPrice.toString()), taxRate: Number(i.taxRate.toString()), discountRate: Number(i.discountRate.toString()), lineTotal: i.lineTotal.toString() })),
    discountType: inv.discountType.toLowerCase(),
    discountValue: Number(inv.discountValue.toString()),
    shipping: inv.shipping.toString(),
    subtotal: inv.subtotal.toString(),
    discountTotal: inv.discountTotal.toString(),
    taxTotal: inv.taxTotal.toString(),
    total: inv.total.toString(),
    amountPaid: inv.amountPaid.toString(),
    notes: inv.notes,
    terms: inv.terms,
    publicUrl: inv.publicToken ? publicInvoiceUrl(inv.publicToken) : null,
    sentAt: inv.sentAt?.toISOString() ?? null,
    paidAt: inv.paidAt?.toISOString() ?? null,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}
