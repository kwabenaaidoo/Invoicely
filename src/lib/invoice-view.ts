import type { Design } from "./design";
import type { InvoiceStatusKey } from "./status";

/** Everything the invoice renderer needs. Plain data: safe to build on the client or the server. */
export type InvoiceView = {
  number: string;
  reference?: string | null;
  status: InvoiceStatusKey;
  issueDate: string; // yyyy-mm-dd
  dueDate: string; // yyyy-mm-dd
  paymentTerms: number;
  currency: string;
  business: {
    name: string;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    taxId?: string | null;
    address?: string | null;
    paymentInfo?: string | null;
    logoUrl?: string | null;
    signatureUrl?: string | null;
  };
  client: {
    name: string;
    company?: string | null;
    email?: string | null;
    phone?: string | null;
    taxId?: string | null;
    address?: string | null;
  };
  items: { description: string; quantity: number; unitPrice: number; taxRate: number; discountRate: number }[];
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  shipping: number;
  amountPaid?: number;
  notes?: string | null;
  terms?: string | null;
  design: Design;
};
