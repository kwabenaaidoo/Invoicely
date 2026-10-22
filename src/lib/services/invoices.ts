import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { calculateInvoice } from "../invoice-calc";
import { minorToDecimal } from "../money";
import { addDays, parseDateInput, todayUtc, toDateInput } from "../utils";
import { DEFAULT_DESIGN, designSchema, type Design } from "../design";
import { randomToken } from "../crypto";
import { emitWebhook, type WebhookEventType } from "../webhooks";
import { audit } from "../audit";
import { sendEmail } from "../email";
import { env } from "../env";
import { assetUrl } from "../storage";
import type { InvoiceFormOutput } from "../validators";
import type { InvoiceStatusKey } from "../status";
import type { InvoiceView } from "../invoice-view";
import { PREFIX, ServiceError, fromPublicId, toPublicId, type Ctx } from "./common";

type Tx = Prisma.TransactionClient;

/* ------------------------------ snapshots -------------------------------- */

export function formatAddress(p: { addressLine1?: string | null; addressLine2?: string | null; city?: string | null; region?: string | null; postalCode?: string | null; country?: string | null }) {
  const cityLine = [p.city, [p.region, p.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [p.addressLine1, p.addressLine2, cityLine, p.country].filter(Boolean).join("\n");
}

/** Split a free-form address textarea back into the two stored lines. */
export function splitAddress(address?: string) {
  const lines = (address ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  return { addressLine1: lines[0] ?? null, addressLine2: lines.slice(1).join(", ") || null };
}

export type BusinessSnapshot = {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  taxId?: string;
  address?: string;
  paymentInfo?: string;
  logoKey?: string | null;
  signatureKey?: string | null;
};
export type ClientSnapshot = { name: string; company?: string; email?: string; phone?: string; taxId?: string; address?: string };

export function businessToSnapshot(b: { name: string; email: string | null; phone: string | null; website: string | null; taxId: string | null; paymentInfo: string | null; logoKey: string | null; signatureKey: string | null; addressLine1: string | null; addressLine2: string | null; city: string | null; region: string | null; postalCode: string | null; country: string | null }): BusinessSnapshot {
  return {
    name: b.name,
    email: b.email ?? undefined,
    phone: b.phone ?? undefined,
    website: b.website ?? undefined,
    taxId: b.taxId ?? undefined,
    address: formatAddress(b) || undefined,
    paymentInfo: b.paymentInfo ?? undefined,
    logoKey: b.logoKey,
    signatureKey: b.signatureKey,
  };
}

export function clientToSnapshot(c: { name: string; company: string | null; email: string | null; phone: string | null; taxId: string | null; addressLine1: string | null; addressLine2: string | null; city: string | null; region: string | null; postalCode: string | null; country: string | null }): ClientSnapshot {
  return {
    name: c.name,
    company: c.company ?? undefined,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    taxId: c.taxId ?? undefined,
    address: formatAddress(c) || undefined,
  };
}

/* ------------------------------- helpers --------------------------------- */

const num = (d: { toString(): string } | null | undefined) => Number(d?.toString() ?? 0);

async function allocateNumber(tx: Tx, businessId: string) {
  for (let i = 0; i < 25; i++) {
    const b = await tx.business.update({
      where: { id: businessId },
      data: { nextInvoiceNumber: { increment: 1 } },
      select: { invoicePrefix: true, invoiceNumberPadding: true, nextInvoiceNumber: true },
    });
    const candidate = `${b.invoicePrefix}${String(b.nextInvoiceNumber - 1).padStart(b.invoiceNumberPadding, "0")}`;
    if (!(await tx.invoice.findUnique({ where: { businessId_number: { businessId, number: candidate } }, select: { id: true } }))) return candidate;
  }
  throw new ServiceError("CONFLICT", "Couldn't allocate an invoice number. Check your numbering settings.");
}

function assertDates(issue: string, due: string) {
  if (due < issue) throw new ServiceError("VALIDATION_ERROR", "Due date can't be before the issue date", [{ path: ["dueDate"], message: "Due date can't be before the issue date" }]);
}

async function resolveTemplate(tx: Tx, businessId: string, templateId?: string | null) {
  if (!templateId) return null;
  const t = await tx.invoiceTemplate.findFirst({ where: { id: templateId, OR: [{ businessId }, { isSystem: true }] }, select: { id: true } });
  if (!t) throw new ServiceError("NOT_FOUND", "Template not found");
  return t.id;
}

async function resolveClient(tx: Tx, businessId: string, clientId?: string | null) {
  if (!clientId) return null;
  const c = await tx.client.findFirst({ where: { id: clientId, businessId }, select: { id: true } });
  if (!c) throw new ServiceError("NOT_FOUND", "Client not found");
  return c.id;
}

const compact = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "")) as Prisma.InputJsonObject;

function buildItemRows(input: InvoiceFormOutput, calc: ReturnType<typeof calculateInvoice>) {
  return input.items.map((it, i) => ({
    position: i,
    productId: it.productId ?? null,
    description: it.description,
    quantity: String(it.quantity),
    unitPrice: String(it.unitPrice),
    taxRate: String(it.taxRate),
    discountRate: String(it.discountRate),
    lineTotal: minorToDecimal(calc.lines[i]!.net, input.currency),
  }));
}

/* ------------------------------ queries ---------------------------------- */

const invoiceInclude = { items: { orderBy: { position: "asc" as const } }, client: { select: { publicId: true, name: true } }, payments: true } satisfies Prisma.InvoiceInclude;
export type InvoiceWithRelations = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

export async function getInvoiceByPublicId(businessId: string, ref: string) {
  const publicId = fromPublicId(PREFIX.invoice, ref);
  if (!publicId) return null;
  return db.invoice.findFirst({ where: { publicId, businessId }, include: invoiceInclude });
}

export async function requireInvoice(businessId: string, ref: string) {
  const inv = await getInvoiceByPublicId(businessId, ref);
  if (!inv) throw new ServiceError("NOT_FOUND", "Invoice not found");
  return inv;
}

export type ListFilters = {
  q?: string;
  status?: InvoiceStatusKey;
  clientId?: string;
  from?: string;
  to?: string;
  sort?: "number" | "issueDate" | "dueDate" | "total" | "status" | "createdAt";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export async function listInvoices(businessId: string, f: ListFilters = {}) {
  await syncOverdue(businessId);
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 20));
  const where: Prisma.InvoiceWhereInput = { businessId };
  if (f.status) where.status = f.status;
  if (f.clientId) where.clientId = f.clientId;
  if (f.from || f.to) where.issueDate = { ...(f.from ? { gte: parseDateInput(f.from) } : {}), ...(f.to ? { lte: parseDateInput(f.to) } : {}) };
  if (f.q?.trim()) {
    const q = f.q.trim();
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { reference: { contains: q, mode: "insensitive" } },
      { client: { is: { OR: [{ name: { contains: q, mode: "insensitive" } }, { company: { contains: q, mode: "insensitive" } }] } } },
    ];
  }
  const sort = f.sort ?? "createdAt";
  const [rows, total] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: [{ [sort]: f.dir ?? "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { client: { select: { publicId: true, name: true } } },
    }),
    db.invoice.count({ where }),
  ]);
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/* ----------------------------- notifications ----------------------------- */

async function notifyOwner(businessId: string, title: string, body: string, link?: string) {
  const b = await db.business.findUnique({ where: { id: businessId }, select: { ownerId: true } });
  if (b) await db.notification.create({ data: { userId: b.ownerId, title, body, link } });
}

/* ------------------------------- webhooks -------------------------------- */

export async function serializeForWebhook(inv: { publicId: string; number: string; status: string; currency: string; total: { toString(): string }; issueDate: Date; dueDate: Date }) {
  return {
    id: toPublicId(PREFIX.invoice, inv.publicId),
    invoiceNumber: inv.number,
    status: inv.status.toLowerCase(),
    currency: inv.currency,
    total: inv.total.toString(),
    issueDate: toDateInput(inv.issueDate),
    dueDate: toDateInput(inv.dueDate),
  };
}

async function emit(businessId: string, type: WebhookEventType, inv: Parameters<typeof serializeForWebhook>[0]) {
  await emitWebhook(businessId, type, await serializeForWebhook(inv));
}

/* ---------------------------- overdue sweeper ----------------------------- */

/** Flip unpaid invoices past their due date to OVERDUE. Cheap, indexed, idempotent. */
export async function syncOverdue(businessId: string) {
  const late = await db.invoice.findMany({
    where: { businessId, status: { in: ["SENT", "PENDING"] }, dueDate: { lt: todayUtc() } },
    select: { id: true, publicId: true, number: true, status: true, currency: true, total: true, issueDate: true, dueDate: true },
  });
  if (late.length === 0) return 0;
  await db.invoice.updateMany({ where: { id: { in: late.map((l) => l.id) } }, data: { status: "OVERDUE" } });
  for (const inv of late) {
    await emit(businessId, "invoice.overdue", { ...inv, status: "OVERDUE" });
    await notifyOwner(businessId, `Invoice ${inv.number} is overdue`, "The due date has passed and the invoice is unpaid.", `/invoices/${toPublicId(PREFIX.invoice, inv.publicId)}`);
  }
  return late.length;
}

/* ------------------------------ create/update ----------------------------- */

export async function createInvoice(ctx: Ctx, input: InvoiceFormOutput) {
  assertDates(input.issueDate, input.dueDate);
  const business = await db.business.findUniqueOrThrow({ where: { id: ctx.businessId } });
  const calc = calculateInvoice({ currency: input.currency, items: input.items, discountType: input.discountType, discountValue: input.discountValue, shipping: input.shipping });

  const invoice = await db.$transaction(async (tx) => {
    const templateId = await resolveTemplate(tx, ctx.businessId, input.templateId);
    let clientId = await resolveClient(tx, ctx.businessId, input.clientId);

    if (!clientId && input.saveClient) {
      const created = await tx.client.create({
        data: { businessId: ctx.businessId, name: input.client.name, company: input.client.company, email: input.client.email, phone: input.client.phone, taxId: input.client.taxId, ...splitAddress(input.client.address) },
      });
      clientId = created.id;
    }

    let number = input.number;
    if (number) {
      if (await tx.invoice.findUnique({ where: { businessId_number: { businessId: ctx.businessId, number } }, select: { id: true } })) {
        throw new ServiceError("CONFLICT", `Invoice number ${number} is already in use`, [{ path: ["number"], message: "This invoice number is already in use" }]);
      }
    } else {
      number = await allocateNumber(tx, ctx.businessId);
    }

    return tx.invoice.create({
      data: {
        businessId: ctx.businessId,
        clientId,
        templateId,
        number,
        reference: input.reference,
        issueDate: parseDateInput(input.issueDate),
        dueDate: parseDateInput(input.dueDate),
        paymentTerms: input.paymentTerms,
        currency: input.currency,
        discountType: input.discountType,
        discountValue: String(input.discountValue),
        shipping: minorToDecimal(calc.shipping, input.currency),
        subtotal: minorToDecimal(calc.subtotal, input.currency),
        discountTotal: minorToDecimal(calc.discountTotal, input.currency),
        taxTotal: minorToDecimal(calc.taxTotal, input.currency),
        total: minorToDecimal(calc.total, input.currency),
        notes: input.notes,
        terms: input.terms,
        footer: input.design.footerText || null,
        businessSnapshot: compact({ ...input.business, logoKey: business.logoKey, signatureKey: business.signatureKey }),
        clientSnapshot: compact(input.client),
        design: input.design as unknown as Prisma.InputJsonObject,
        items: { create: buildItemRows(input, calc) },
      },
    });
  });

  await audit({ userId: ctx.userId, action: "invoice.create", entity: "Invoice", entityId: invoice.id });
  await emit(ctx.businessId, "invoice.created", invoice);
  return invoice;
}

const EDITABLE: InvoiceStatusKey[] = ["DRAFT", "SENT", "PENDING", "OVERDUE"];

export async function updateInvoice(ctx: Ctx, ref: string, input: InvoiceFormOutput) {
  assertDates(input.issueDate, input.dueDate);
  const existing = await requireInvoice(ctx.businessId, ref);
  if (!EDITABLE.includes(existing.status)) throw new ServiceError("CONFLICT", `A ${existing.status.toLowerCase()} invoice can't be edited`);
  const business = await db.business.findUniqueOrThrow({ where: { id: ctx.businessId } });
  const calc = calculateInvoice({ currency: input.currency, items: input.items, discountType: input.discountType, discountValue: input.discountValue, shipping: input.shipping });

  const invoice = await db.$transaction(async (tx) => {
    const templateId = await resolveTemplate(tx, ctx.businessId, input.templateId);
    let clientId = await resolveClient(tx, ctx.businessId, input.clientId);
    if (!clientId && input.saveClient) {
      clientId = (await tx.client.create({ data: { businessId: ctx.businessId, name: input.client.name, company: input.client.company, email: input.client.email, phone: input.client.phone, taxId: input.client.taxId, ...splitAddress(input.client.address) } })).id;
    }
    const number = input.number || existing.number;
    if (number !== existing.number && (await tx.invoice.findUnique({ where: { businessId_number: { businessId: ctx.businessId, number } }, select: { id: true } }))) {
      throw new ServiceError("CONFLICT", `Invoice number ${number} is already in use`, [{ path: ["number"], message: "This invoice number is already in use" }]);
    }
    await tx.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
    const stillLate = existing.status === "OVERDUE" && input.dueDate < toDateInput(todayUtc());
    return tx.invoice.update({
      where: { id: existing.id },
      data: {
        clientId,
        templateId,
        number,
        reference: input.reference ?? null,
        issueDate: parseDateInput(input.issueDate),
        dueDate: parseDateInput(input.dueDate),
        paymentTerms: input.paymentTerms,
        currency: input.currency,
        discountType: input.discountType,
        discountValue: String(input.discountValue),
        shipping: minorToDecimal(calc.shipping, input.currency),
        subtotal: minorToDecimal(calc.subtotal, input.currency),
        discountTotal: minorToDecimal(calc.discountTotal, input.currency),
        taxTotal: minorToDecimal(calc.taxTotal, input.currency),
        total: minorToDecimal(calc.total, input.currency),
        notes: input.notes ?? null,
        terms: input.terms ?? null,
        footer: input.design.footerText || null,
        status: existing.status === "OVERDUE" && !stillLate ? "SENT" : existing.status,
        businessSnapshot: compact({ ...input.business, logoKey: business.logoKey, signatureKey: business.signatureKey }),
        clientSnapshot: compact(input.client),
        design: input.design as unknown as Prisma.InputJsonObject,
        items: { create: buildItemRows(input, calc) },
      },
    });
  });

  await audit({ userId: ctx.userId, action: "invoice.update", entity: "Invoice", entityId: invoice.id });
  await emit(ctx.businessId, "invoice.updated", invoice);
  return invoice;
}

/* -------------------------------- status --------------------------------- */

const STATUS_EVENT: Partial<Record<InvoiceStatusKey, WebhookEventType>> = {
  SENT: "invoice.sent",
  PAID: "invoice.paid",
  OVERDUE: "invoice.overdue",
  CANCELLED: "invoice.cancelled",
};

export async function changeStatus(ctx: Ctx, ref: string, status: InvoiceStatusKey) {
  const inv = await requireInvoice(ctx.businessId, ref);
  if (inv.status === status) return inv;
  const now = new Date();

  const updated = await db.$transaction(async (tx) => {
    if (inv.status === "PAID" && status !== "PAID") {
      await tx.invoicePayment.deleteMany({ where: { invoiceId: inv.id } });
    }
    if (status === "PAID") {
      const outstanding = num(inv.total) - num(inv.amountPaid);
      if (outstanding > 0) {
        await tx.invoicePayment.create({ data: { invoiceId: inv.id, amount: outstanding.toFixed(2), method: "manual", note: "Marked as paid", paidAt: now } });
      }
    }
    return tx.invoice.update({
      where: { id: inv.id },
      data: {
        status,
        sentAt: status === "SENT" && !inv.sentAt ? now : inv.sentAt,
        paidAt: status === "PAID" ? now : null,
        cancelledAt: status === "CANCELLED" ? now : null,
        amountPaid: status === "PAID" ? inv.total : "0",
        // Cancelling or reverting to draft makes the public link inert.
        ...(status === "CANCELLED" || status === "DRAFT" ? { publicToken: null, publicShareAt: null } : {}),
      },
    });
  });

  await audit({ userId: ctx.userId, action: "invoice.status", entity: "Invoice", entityId: inv.id, meta: { from: inv.status, to: status } });
  await emit(ctx.businessId, STATUS_EVENT[status] ?? "invoice.updated", updated);
  if (status === "PAID") await notifyOwner(ctx.businessId, `Invoice ${inv.number} was paid`, "The invoice has been marked as paid.", `/invoices/${toPublicId(PREFIX.invoice, inv.publicId)}`);
  return updated;
}

export async function duplicateInvoice(ctx: Ctx, ref: string) {
  const src = await requireInvoice(ctx.businessId, ref);
  const today = todayUtc();
  const copy = await db.$transaction(async (tx) => {
    const number = await allocateNumber(tx, ctx.businessId);
    return tx.invoice.create({
      data: {
        businessId: ctx.businessId,
        clientId: src.clientId,
        templateId: src.templateId,
        number,
        reference: src.reference,
        status: "DRAFT",
        issueDate: today,
        dueDate: addDays(today, src.paymentTerms),
        paymentTerms: src.paymentTerms,
        currency: src.currency,
        discountType: src.discountType,
        discountValue: src.discountValue,
        shipping: src.shipping,
        subtotal: src.subtotal,
        discountTotal: src.discountTotal,
        taxTotal: src.taxTotal,
        total: src.total,
        notes: src.notes,
        terms: src.terms,
        footer: src.footer,
        businessSnapshot: src.businessSnapshot as Prisma.InputJsonObject,
        clientSnapshot: src.clientSnapshot as Prisma.InputJsonObject,
        design: src.design as Prisma.InputJsonObject,
        items: { create: src.items.map((i) => ({ position: i.position, productId: i.productId, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate, discountRate: i.discountRate, lineTotal: i.lineTotal })) },
      },
    });
  });
  await audit({ userId: ctx.userId, action: "invoice.duplicate", entity: "Invoice", entityId: copy.id, meta: { from: src.id } });
  await emit(ctx.businessId, "invoice.created", copy);
  return copy;
}

export async function deleteInvoice(ctx: Ctx, ref: string) {
  const inv = await requireInvoice(ctx.businessId, ref);
  if (inv.status === "PAID") throw new ServiceError("CONFLICT", "Paid invoices can't be deleted. Cancel it instead if it was a mistake.");
  await db.invoice.delete({ where: { id: inv.id } });
  await audit({ userId: ctx.userId, action: "invoice.delete", entity: "Invoice", entityId: inv.id, meta: { number: inv.number } });
}

/* -------------------------------- sharing -------------------------------- */

export async function enableSharing(ctx: Ctx, ref: string) {
  const inv = await requireInvoice(ctx.businessId, ref);
  if (inv.status === "DRAFT") throw new ServiceError("CONFLICT", "Finalize the invoice before sharing it. Drafts can't have a public link.");
  if (inv.status === "CANCELLED") throw new ServiceError("CONFLICT", "Cancelled invoices can't be shared.");
  if (inv.publicToken) return inv;
  const updated = await db.invoice.update({ where: { id: inv.id }, data: { publicToken: randomToken(32), publicShareAt: new Date() } });
  await audit({ userId: ctx.userId, action: "invoice.share", entity: "Invoice", entityId: inv.id });
  return updated;
}

export async function revokeSharing(ctx: Ctx, ref: string) {
  const inv = await requireInvoice(ctx.businessId, ref);
  const updated = await db.invoice.update({ where: { id: inv.id }, data: { publicToken: null, publicShareAt: null } });
  await audit({ userId: ctx.userId, action: "invoice.unshare", entity: "Invoice", entityId: inv.id });
  return updated;
}

export const publicInvoiceUrl = (token: string) => `${env.APP_URL}/invoice/public/${token}`;

/** Mark as sent, make sure a public link exists, and email it to the client when we have an address. */
export async function sendInvoice(ctx: Ctx, ref: string) {
  let inv = await requireInvoice(ctx.businessId, ref);
  if (inv.status === "CANCELLED" || inv.status === "PAID") throw new ServiceError("CONFLICT", `A ${inv.status.toLowerCase()} invoice can't be sent`);
  if (inv.status === "DRAFT") await changeStatus(ctx, ref, "SENT");
  inv = await enableSharing(ctx, ref).then(() => requireInvoice(ctx.businessId, ref));
  const token = inv.publicToken!;
  const client = inv.clientSnapshot as ClientSnapshot;
  const business = inv.businessSnapshot as BusinessSnapshot;
  let emailed = false;
  if (client.email) {
    const url = publicInvoiceUrl(token);
    const res = await sendEmail({
      to: client.email,
      subject: `Invoice ${inv.number} from ${business.name}`,
      text: `Hi ${client.name},\n\n${business.name} sent you invoice ${inv.number} for ${inv.currency} ${inv.total.toString()}, due ${toDateInput(inv.dueDate)}.\n\nView it online: ${url}\n`,
    });
    emailed = res.delivered;
  }
  await audit({ userId: ctx.userId, action: "invoice.send", entity: "Invoice", entityId: inv.id });
  return { invoice: inv, url: publicInvoiceUrl(token), emailed };
}

/* ---------------------------------- view --------------------------------- */

export function invoiceToView(inv: InvoiceWithRelations | (Omit<InvoiceWithRelations, "client" | "payments">)): InvoiceView {
  const b = inv.businessSnapshot as BusinessSnapshot;
  const c = inv.clientSnapshot as ClientSnapshot;
  const parsed = designSchema.safeParse(inv.design);
  const design: Design = parsed.success ? parsed.data : DEFAULT_DESIGN;
  return {
    number: inv.number,
    reference: inv.reference,
    status: inv.status,
    issueDate: toDateInput(inv.issueDate),
    dueDate: toDateInput(inv.dueDate),
    paymentTerms: inv.paymentTerms,
    currency: inv.currency,
    business: { ...b, logoUrl: assetUrl(b.logoKey), signatureUrl: assetUrl(b.signatureKey) },
    client: c,
    items: inv.items.map((i) => ({ description: i.description, quantity: num(i.quantity), unitPrice: num(i.unitPrice), taxRate: num(i.taxRate), discountRate: num(i.discountRate) })),
    discountType: inv.discountType,
    discountValue: num(inv.discountValue),
    shipping: num(inv.shipping),
    amountPaid: num(inv.amountPaid),
    notes: inv.notes,
    terms: inv.terms,
    design,
  };
}
