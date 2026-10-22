import { DEFAULT_DESIGN } from "@/lib/design";
import type { InvoiceView } from "@/lib/invoice-view";

export function sampleView(overrides: Partial<InvoiceView> = {}): InvoiceView {
  return {
    number: "INV-0042",
    reference: "PO-2291",
    status: "SENT",
    issueDate: "2026-10-01",
    dueDate: "2026-10-15",
    paymentTerms: 14,
    currency: "USD",
    business: {
      name: "Northwind Studio",
      email: "billing@northwind.studio",
      phone: "+1 415 555 0142",
      website: "northwind.studio",
      taxId: "US-84-1920331",
      address: "88 Market Street\nSan Francisco, CA 94103\nUnited States",
      paymentInfo: "Bank: First Republic\nAccount: 0021 4478 19\nRouting: 321081669",
    },
    client: { name: "Ada Mensah", company: "Globex Ltd", email: "ada@globex.com", address: "14 Spintex Road\nAccra, Ghana" },
    items: [
      { description: "Brand identity design", quantity: 1, unitPrice: 2400, taxRate: 0, discountRate: 0 },
      { description: "Website design (8 pages)", quantity: 8, unitPrice: 320, taxRate: 0, discountRate: 10 },
      { description: "Monthly hosting & support", quantity: 3, unitPrice: 49, taxRate: 0, discountRate: 0 },
    ],
    discountType: "PERCENT",
    discountValue: 0,
    shipping: 0,
    amountPaid: 0,
    notes: "Thank you for your business. Payment is due within 14 days.",
    terms: null,
    design: { ...DEFAULT_DESIGN, footerText: "Northwind Studio · billing@northwind.studio" },
    ...overrides,
  };
}
