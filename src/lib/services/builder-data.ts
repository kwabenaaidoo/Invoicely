import "server-only";
import type { Business } from "@/generated/prisma/client";
import { db } from "../db";
import { DEFAULT_DESIGN } from "../design";
import { assetUrl } from "../storage";
import type { BuilderDefaults } from "../invoice-form";
import { listClients, serializeClient } from "./clients";
import { listProducts, serializeProduct } from "./products";
import { listTemplates } from "./templates";
import { formatAddress } from "./invoices";

export const nextNumberPreview = (b: Pick<Business, "invoicePrefix" | "invoiceNumberPadding" | "nextInvoiceNumber">) =>
  `${b.invoicePrefix}${String(b.nextInvoiceNumber).padStart(b.invoiceNumberPadding, "0")}`;

export async function loadBuilderData(business: Business) {
  const [clients, products, templates] = await Promise.all([
    listClients(business.id, { pageSize: 100 }),
    listProducts(business.id, { pageSize: 100 }),
    listTemplates(business.id, business.defaultTemplateId),
  ]);
  const def = templates.find((t) => t.isDefault) ?? templates.find((t) => t.name === "Modern") ?? null;
  const defaults: BuilderDefaults = {
    business: {
      name: business.name,
      email: business.email ?? undefined,
      phone: business.phone ?? undefined,
      website: business.website ?? undefined,
      taxId: business.taxId ?? undefined,
      address: formatAddress(business) || undefined,
      paymentInfo: business.paymentInfo ?? undefined,
    },
    currency: business.defaultCurrency,
    paymentTerms: business.defaultPaymentTerms,
    taxRate: Number(business.defaultTaxRate.toString()),
    notes: business.defaultNotes ?? undefined,
    footer: business.defaultFooter ?? undefined,
    design: def?.design ?? DEFAULT_DESIGN,
    templateId: def?.id ?? null,
  };
  return {
    clients: clients.rows.map(serializeClient),
    products: products.rows.map(serializeProduct),
    templates,
    defaults,
    logoUrl: assetUrl(business.logoKey),
    signatureUrl: assetUrl(business.signatureKey),
    nextNumber: nextNumberPreview(business),
  };
}

export async function productPublicIds(businessId: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const rows = await db.product.findMany({ where: { businessId, id: { in: ids } }, select: { id: true, publicId: true } });
  return new Map(rows.map((r) => [r.id, `prod_${r.publicId}`]));
}
