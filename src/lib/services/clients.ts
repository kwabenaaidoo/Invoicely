import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { audit } from "../audit";
import type { clientSchema } from "../validators";
import type { z } from "zod";
import { PREFIX, ServiceError, fromPublicId, toPublicId, type Ctx } from "./common";
import { formatAddress } from "./invoices";

type ClientInput = z.output<typeof clientSchema>;

export type ClientRow = Prisma.ClientGetPayload<object>;

export function serializeClient(c: ClientRow) {
  return {
    id: toPublicId(PREFIX.client, c.publicId),
    name: c.name,
    company: c.company,
    email: c.email,
    phone: c.phone,
    addressLine1: c.addressLine1,
    addressLine2: c.addressLine2,
    city: c.city,
    region: c.region,
    postalCode: c.postalCode,
    country: c.country,
    taxId: c.taxId,
    notes: c.notes,
    address: formatAddress(c),
    createdAt: c.createdAt.toISOString(),
  };
}
export type ClientDTO = ReturnType<typeof serializeClient>;

const data = (i: ClientInput) => ({
  name: i.name,
  company: i.company ?? null,
  email: i.email ?? null,
  phone: i.phone ?? null,
  addressLine1: i.addressLine1 ?? null,
  addressLine2: i.addressLine2 ?? null,
  city: i.city ?? null,
  region: i.region ?? null,
  postalCode: i.postalCode ?? null,
  country: i.country ?? null,
  taxId: i.taxId ?? null,
  notes: i.notes ?? null,
});

export async function listClients(businessId: string, opts: { q?: string; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const where: Prisma.ClientWhereInput = { businessId };
  const q = opts.q?.trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  const [rows, total] = await Promise.all([
    db.client.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
    db.client.count({ where }),
  ]);
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getClient(businessId: string, ref: string) {
  const publicId = fromPublicId(PREFIX.client, ref);
  if (!publicId) return null;
  return db.client.findFirst({ where: { publicId, businessId } });
}

export async function requireClient(businessId: string, ref: string) {
  const c = await getClient(businessId, ref);
  if (!c) throw new ServiceError("NOT_FOUND", "Client not found");
  return c;
}

/** Per-currency totals so amounts in different currencies are never added together. */
export async function clientTotals(businessId: string, clientIds: string[]) {
  if (clientIds.length === 0) return new Map<string, { currency: string; invoiced: number; outstanding: number }[]>();
  const rows = await db.invoice.groupBy({
    by: ["clientId", "currency", "status"],
    where: { businessId, clientId: { in: clientIds }, status: { notIn: ["DRAFT", "CANCELLED"] } },
    _sum: { total: true, amountPaid: true },
  });
  const out = new Map<string, Map<string, { currency: string; invoiced: number; outstanding: number }>>();
  for (const r of rows) {
    if (!r.clientId) continue;
    const perClient = out.get(r.clientId) ?? new Map();
    const cur = perClient.get(r.currency) ?? { currency: r.currency, invoiced: 0, outstanding: 0 };
    const total = Number(r._sum.total ?? 0);
    cur.invoiced += total;
    if (r.status !== "PAID") cur.outstanding += total - Number(r._sum.amountPaid ?? 0);
    perClient.set(r.currency, cur);
    out.set(r.clientId, perClient);
  }
  return new Map([...out].map(([k, v]) => [k, [...v.values()]]));
}

export async function createClient(ctx: Ctx, input: ClientInput) {
  const c = await db.client.create({ data: { businessId: ctx.businessId, ...data(input) } });
  await audit({ userId: ctx.userId, action: "client.create", entity: "Client", entityId: c.id });
  return c;
}

export async function updateClient(ctx: Ctx, ref: string, input: ClientInput) {
  const existing = await requireClient(ctx.businessId, ref);
  const c = await db.client.update({ where: { id: existing.id }, data: data(input) });
  await audit({ userId: ctx.userId, action: "client.update", entity: "Client", entityId: c.id });
  return c;
}

export async function deleteClient(ctx: Ctx, ref: string) {
  const existing = await requireClient(ctx.businessId, ref);
  // Invoices keep their own client snapshot, so deleting a client never changes issued invoices.
  await db.client.delete({ where: { id: existing.id } });
  await audit({ userId: ctx.userId, action: "client.delete", entity: "Client", entityId: existing.id, meta: { name: existing.name } });
}
