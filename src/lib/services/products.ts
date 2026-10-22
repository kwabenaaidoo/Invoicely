import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { z } from "zod";
import { db } from "../db";
import { audit } from "../audit";
import type { productSchema } from "../validators";
import { PREFIX, ServiceError, fromPublicId, toPublicId, type Ctx } from "./common";

type ProductInput = z.output<typeof productSchema>;
export type ProductRow = Prisma.ProductGetPayload<object>;

export function serializeProduct(p: ProductRow) {
  return {
    id: toPublicId(PREFIX.product, p.publicId),
    name: p.name,
    description: p.description,
    sku: p.sku,
    unitPrice: Number(p.unitPrice.toString()),
    taxRate: Number(p.taxRate.toString()),
    currency: p.currency,
    createdAt: p.createdAt.toISOString(),
  };
}
export type ProductDTO = ReturnType<typeof serializeProduct>;

export async function listProducts(businessId: string, opts: { q?: string; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const where: Prisma.ProductWhereInput = { businessId };
  const q = opts.q?.trim();
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }];
  const [rows, total] = await Promise.all([
    db.product.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
    db.product.count({ where }),
  ]);
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function requireProduct(businessId: string, ref: string) {
  const publicId = fromPublicId(PREFIX.product, ref);
  const p = publicId ? await db.product.findFirst({ where: { publicId, businessId } }) : null;
  if (!p) throw new ServiceError("NOT_FOUND", "Product not found");
  return p;
}

const data = (i: ProductInput) => ({
  name: i.name,
  description: i.description ?? null,
  sku: i.sku ?? null,
  unitPrice: String(i.unitPrice),
  taxRate: String(i.taxRate),
  currency: i.currency,
});

async function guardSku(businessId: string, sku: string | undefined, exceptId?: string) {
  if (!sku) return;
  const dupe = await db.product.findFirst({ where: { businessId, sku, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
  if (dupe) throw new ServiceError("CONFLICT", "Another product already uses this SKU", [{ path: ["sku"], message: "This SKU is already in use" }]);
}

export async function createProduct(ctx: Ctx, input: ProductInput) {
  await guardSku(ctx.businessId, input.sku);
  const p = await db.product.create({ data: { businessId: ctx.businessId, ...data(input) } });
  await audit({ userId: ctx.userId, action: "product.create", entity: "Product", entityId: p.id });
  return p;
}

export async function updateProduct(ctx: Ctx, ref: string, input: ProductInput) {
  const existing = await requireProduct(ctx.businessId, ref);
  await guardSku(ctx.businessId, input.sku, existing.id);
  const p = await db.product.update({ where: { id: existing.id }, data: data(input) });
  await audit({ userId: ctx.userId, action: "product.update", entity: "Product", entityId: p.id });
  return p;
}

export async function deleteProduct(ctx: Ctx, ref: string) {
  const existing = await requireProduct(ctx.businessId, ref);
  await db.product.delete({ where: { id: existing.id } });
  await audit({ userId: ctx.userId, action: "product.delete", entity: "Product", entityId: existing.id });
}
