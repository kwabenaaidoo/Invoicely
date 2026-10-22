import { z } from "zod";
import { CURRENCY_CODES } from "./money";
import { designSchema } from "./design";
import { INVOICE_STATUSES } from "./status";

// Shared by client forms (React Hook Form) and server actions / REST routes.
// Strings are trimmed and stripped of control characters; React and the PDF renderer
// escape on output, so this is defence in depth against junk, not the XSS control.

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const clean = (v: string) => v.replace(CONTROL, "").trim();

export const text = (max: number, min = 0) =>
  z.string().transform(clean).pipe(z.string().min(min, min ? `Required` : undefined).max(max, `Keep it under ${max} characters`));

export const optionalText = (max: number) =>
  z
    .string()
    .nullish()
    .transform((v) => (v == null ? undefined : clean(v)))
    .pipe(z.string().max(max, `Keep it under ${max} characters`).optional())
    .transform((v) => (v === "" ? undefined : v));

export const email = z.string().transform((v) => clean(v).toLowerCase()).pipe(z.email("Enter a valid email address").max(254));
export const optionalEmail = z
  .string()
  .nullish()
  .transform((v) => (v ? clean(v).toLowerCase() : undefined))
  .pipe(z.email("Enter a valid email address").max(254).optional());
export const optionalUrl = z
  .string()
  .nullish()
  .transform((v) => (v ? clean(v) : undefined))
  .pipe(z.url({ protocol: /^https?$/, error: "Enter a full URL starting with https://" }).max(300).optional());

export const uuid = z.uuid();
export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
const num = (label: string) => z.number({ error: `${label}: enter a number` }).finite();
export const currency = z.enum(CURRENCY_CODES);

/* ------------------------------- auth ---------------------------------- */

const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Use at most 128 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const signupSchema = z
  .object({ name: text(80, 2), email, password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });
export type SignupInput = z.input<typeof signupSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(128),
  remember: z.boolean().optional(),
});
export type LoginInput = z.input<typeof loginSchema>;

export const forgotSchema = z.object({ email });
export const resetSchema = z
  .object({ token: z.string().min(20), password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password"), password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

export const profileSchema = z.object({ name: text(80, 2), email });

/* ----------------------------- business ---------------------------------- */

export const businessSchema = z.object({
  name: text(120, 1),
  email: optionalEmail,
  phone: optionalText(40),
  website: optionalUrl,
  taxId: optionalText(60),
  addressLine1: optionalText(160),
  addressLine2: optionalText(160),
  city: optionalText(80),
  region: optionalText(80),
  postalCode: optionalText(20),
  country: optionalText(80),
  paymentInfo: optionalText(1000),
});

export const invoiceSettingsSchema = z.object({
  defaultCurrency: currency,
  invoicePrefix: text(12),
  invoiceNumberPadding: z.number().int().min(1).max(10),
  nextInvoiceNumber: z.number().int().min(1).max(999_999_999),
  defaultPaymentTerms: z.number().int().min(0).max(365),
  defaultTaxRate: z.number().min(0).max(100),
  defaultNotes: optionalText(2000),
  defaultFooter: optionalText(500),
});

/* ------------------------------ clients ---------------------------------- */

export const clientSchema = z.object({
  name: text(120, 1),
  company: optionalText(120),
  email: optionalEmail,
  phone: optionalText(40),
  addressLine1: optionalText(160),
  addressLine2: optionalText(160),
  city: optionalText(80),
  region: optionalText(80),
  postalCode: optionalText(20),
  country: optionalText(80),
  taxId: optionalText(60),
  notes: optionalText(2000),
});
export type ClientInput = z.input<typeof clientSchema>;

/* ------------------------------ products --------------------------------- */

export const productSchema = z.object({
  name: text(120, 1),
  description: optionalText(1000),
  sku: optionalText(60),
  unitPrice: num("Unit price").min(0, "Price can't be negative").max(1_000_000_000),
  taxRate: num("Tax").min(0, "Tax can't be negative").max(100, "Tax can't exceed 100%"),
  currency,
});
export type ProductInput = z.input<typeof productSchema>;

/* ------------------------------ invoices --------------------------------- */

export const invoiceItemSchema = z.object({
  productId: uuid.nullish(),
  description: text(500, 1),
  quantity: num("Quantity").min(0.001, "Quantity must be greater than 0").max(1_000_000),
  unitPrice: num("Unit price").min(0, "Price can't be negative").max(1_000_000_000),
  taxRate: num("Tax").min(0, "Tax can't be negative").max(100, "Tax can't exceed 100%").default(0),
  discountRate: num("Discount").min(0, "Discount can't be negative").max(100, "Discount can't exceed 100%").default(0),
});

export const partySchema = z.object({
  name: text(120, 1),
  company: optionalText(120),
  email: optionalEmail,
  phone: optionalText(40),
  website: optionalUrl,
  taxId: optionalText(60),
  address: optionalText(500),
  paymentInfo: optionalText(1000),
});

export const invoiceSchema = z.object({
  clientId: uuid.nullish(),
  saveClient: z.boolean().optional(),
  templateId: uuid.nullish(),
  number: optionalText(40),
  reference: optionalText(80),
  issueDate: dateString,
  dueDate: dateString,
  paymentTerms: z.number().int().min(0).max(365),
  currency,
  discountType: z.enum(["PERCENT", "FIXED"]),
  discountValue: num("Discount").min(0, "Discount can't be negative").max(1_000_000_000),
  shipping: num("Shipping").min(0, "Shipping can't be negative").max(1_000_000_000),
  notes: optionalText(2000),
  terms: optionalText(2000),
  business: partySchema.omit({ company: true }),
  client: partySchema.omit({ paymentInfo: true, website: true }),
  design: designSchema,
  items: z.array(invoiceItemSchema).min(1, "Add at least one item").max(200),
});
export type InvoiceFormInput = z.input<typeof invoiceSchema>;
export type InvoiceFormOutput = z.output<typeof invoiceSchema>;

export const statusSchema = z.enum(INVOICE_STATUSES);

/* ------------------------------ templates -------------------------------- */

export const templateSchema = z.object({ name: text(60, 1), design: designSchema });

/* ------------------------------ developer -------------------------------- */

export const apiKeySchema = z.object({
  name: text(60, 1),
  mode: z.enum(["TEST", "LIVE"]),
});

export const WEBHOOK_EVENTS = ["invoice.created", "invoice.updated", "invoice.sent", "invoice.paid", "invoice.overdue", "invoice.cancelled"] as const;
export const webhookSchema = z.object({
  url: z.url({ protocol: /^https$/, error: "Webhook URLs must use https://" }).max(500),
  description: optionalText(120),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "Choose at least one event"),
});

/* ---------------------------- list queries -------------------------------- */

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
