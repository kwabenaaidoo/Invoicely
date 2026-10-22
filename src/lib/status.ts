export const INVOICE_STATUSES = ["DRAFT", "SENT", "PENDING", "PAID", "OVERDUE", "CANCELLED"] as const;
export type InvoiceStatusKey = (typeof INVOICE_STATUSES)[number];

/**
 * Status is communicated by label + icon + colour, never colour alone (WCAG 1.4.1).
 * `icon` names map to lucide icons in <StatusBadge />.
 */
export const STATUS_META: Record<InvoiceStatusKey, { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" | "muted"; icon: string }> = {
  DRAFT: { label: "Draft", tone: "neutral", icon: "FilePen" },
  SENT: { label: "Sent", tone: "info", icon: "Send" },
  PENDING: { label: "Pending", tone: "warning", icon: "Clock" },
  PAID: { label: "Paid", tone: "success", icon: "CircleCheck" },
  OVERDUE: { label: "Overdue", tone: "danger", icon: "CircleAlert" },
  CANCELLED: { label: "Cancelled", tone: "muted", icon: "Ban" },
};

export const API_STATUS: Record<InvoiceStatusKey, string> = {
  DRAFT: "draft",
  SENT: "sent",
  PENDING: "pending",
  PAID: "paid",
  OVERDUE: "overdue",
  CANCELLED: "cancelled",
};

export function statusFromApi(value: string): InvoiceStatusKey | null {
  const hit = (Object.entries(API_STATUS) as [InvoiceStatusKey, string][]).find(([, v]) => v === value.toLowerCase());
  return hit ? hit[0] : null;
}

/** Statuses a finalized invoice can be shared / sent from. */
export const SHAREABLE: InvoiceStatusKey[] = ["SENT", "PENDING", "PAID", "OVERDUE"];
export const UNPAID: InvoiceStatusKey[] = ["SENT", "PENDING", "OVERDUE"];
