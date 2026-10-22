import "server-only";
import { db } from "../db";
import { audit } from "../audit";
import { DEFAULT_DESIGN, SYSTEM_TEMPLATES, designSchema, type Design } from "../design";
import type { Prisma } from "@/generated/prisma/client";
import { ServiceError, type Ctx } from "./common";

/** System templates are rows with businessId = null. Seeded lazily and idempotently. */
export async function ensureSystemTemplates() {
  const existing = await db.invoiceTemplate.findMany({ where: { isSystem: true }, select: { name: true } });
  const have = new Set(existing.map((t) => t.name));
  const missing = SYSTEM_TEMPLATES.filter((t) => !have.has(t.name));
  if (missing.length) {
    await db.invoiceTemplate.createMany({
      data: missing.map((t) => ({ name: t.name, layout: t.layout, config: t.design as unknown as Prisma.InputJsonObject, isSystem: true })),
    });
  }
}

export type TemplateDTO = { id: string; name: string; layout: Design["layout"]; design: Design; isSystem: boolean; isDefault: boolean };

export async function listTemplates(businessId: string, defaultTemplateId: string | null): Promise<TemplateDTO[]> {
  await ensureSystemTemplates();
  const rows = await db.invoiceTemplate.findMany({
    where: { OR: [{ businessId }, { isSystem: true }] },
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
  });
  const order = SYSTEM_TEMPLATES.map((t) => t.name);
  const dtos = rows.map((t) => {
    const parsed = designSchema.safeParse(t.config);
    return { id: t.id, name: t.name, layout: t.layout, design: parsed.success ? parsed.data : DEFAULT_DESIGN, isSystem: t.isSystem, isDefault: t.id === defaultTemplateId };
  });
  return dtos.sort((a, b) => Number(b.isSystem) - Number(a.isSystem) || (order.indexOf(a.name) === -1 ? 99 : order.indexOf(a.name)) - (order.indexOf(b.name) === -1 ? 99 : order.indexOf(b.name)));
}

async function ownTemplate(ctx: Ctx, id: string) {
  const t = await db.invoiceTemplate.findFirst({ where: { id, businessId: ctx.businessId, isSystem: false } });
  if (!t) throw new ServiceError("NOT_FOUND", "Template not found, or it's a built-in template that can't be changed");
  return t;
}

export async function createTemplate(ctx: Ctx, name: string, design: Design) {
  const count = await db.invoiceTemplate.count({ where: { businessId: ctx.businessId } });
  if (count >= 50) throw new ServiceError("CONFLICT", "You've reached the limit of 50 custom templates");
  const t = await db.invoiceTemplate.create({ data: { businessId: ctx.businessId, name, layout: design.layout, config: design as unknown as Prisma.InputJsonObject } });
  await audit({ userId: ctx.userId, action: "template.create", entity: "InvoiceTemplate", entityId: t.id });
  return t;
}

export async function updateTemplate(ctx: Ctx, id: string, name: string, design: Design) {
  const t = await ownTemplate(ctx, id);
  const updated = await db.invoiceTemplate.update({ where: { id: t.id }, data: { name, layout: design.layout, config: design as unknown as Prisma.InputJsonObject } });
  await audit({ userId: ctx.userId, action: "template.update", entity: "InvoiceTemplate", entityId: t.id });
  return updated;
}

export async function deleteTemplate(ctx: Ctx, id: string) {
  const t = await ownTemplate(ctx, id);
  await db.$transaction([
    db.business.updateMany({ where: { id: ctx.businessId, defaultTemplateId: t.id }, data: { defaultTemplateId: null } }),
    db.invoiceTemplate.delete({ where: { id: t.id } }),
  ]);
  await audit({ userId: ctx.userId, action: "template.delete", entity: "InvoiceTemplate", entityId: t.id });
}

export async function setDefaultTemplate(ctx: Ctx, id: string | null) {
  if (id) {
    const ok = await db.invoiceTemplate.findFirst({ where: { id, OR: [{ businessId: ctx.businessId }, { isSystem: true }] }, select: { id: true } });
    if (!ok) throw new ServiceError("NOT_FOUND", "Template not found");
  }
  await db.business.update({ where: { id: ctx.businessId }, data: { defaultTemplateId: id } });
  await audit({ userId: ctx.userId, action: "template.set_default", entity: "InvoiceTemplate", entityId: id });
}
