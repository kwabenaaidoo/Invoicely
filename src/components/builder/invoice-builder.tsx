"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Pencil, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScaledInvoice } from "@/components/invoice/scaled-invoice";
import { calculateInvoice } from "@/lib/invoice-calc";
import { CURRENCIES, formatMinor } from "@/lib/money";
import { invoiceFormSchema, valuesToView, type InvoiceFormValues } from "@/lib/invoice-form";
import { saveInvoiceAction, setStatusAction } from "@/lib/actions/invoices";
import type { ClientDTO } from "@/lib/services/clients";
import type { ProductDTO } from "@/lib/services/products";
import type { TemplateDTO } from "@/lib/services/templates";
import type { InvoiceStatusKey } from "@/lib/status";
import { addDays, parseDateInput, toDateInput } from "@/lib/utils";
import { DesignPanel } from "./design-panel";
import { ItemsEditor } from "./items-editor";

const TERMS = [0, 7, 14, 15, 30, 45, 60, 90];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {description ? <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function Preview({ control, status, logoUrl, signatureUrl, nextNumber }: { control: ReturnType<typeof useForm<InvoiceFormValues>>["control"]; status: InvoiceStatusKey; logoUrl?: string | null; signatureUrl?: string | null; nextNumber: string }) {
  const values = useWatch({ control }) as InvoiceFormValues;
  const view = React.useMemo(() => valuesToView({ ...values, number: values.number?.trim() || nextNumber }, { status, logoUrl, signatureUrl }), [values, status, logoUrl, signatureUrl, nextNumber]);
  return (
    <div className="overflow-hidden rounded-lg border bg-white shadow-card">
      <ScaledInvoice view={view} id="invoice-live" />
    </div>
  );
}

function Totals({ control, currency }: { control: ReturnType<typeof useForm<InvoiceFormValues>>["control"]; currency: string }) {
  const v = useWatch({ control }) as InvoiceFormValues;
  const calc = React.useMemo(
    () =>
      calculateInvoice({
        currency,
        items: (v.items ?? []).map((i) => ({ quantity: Number(i?.quantity) || 0, unitPrice: Number(i?.unitPrice) || 0, taxRate: Number(i?.taxRate) || 0, discountRate: Number(i?.discountRate) || 0 })),
        discountType: v.discountType,
        discountValue: Number(v.discountValue) || 0,
        shipping: Number(v.shipping) || 0,
      }),
    [v.items, v.discountType, v.discountValue, v.shipping, currency],
  );
  const row = (label: string, value: string, strong?: boolean) => (
    <div className={`flex items-center justify-between gap-4 py-1.5 ${strong ? "border-t pt-3 text-base font-semibold" : "text-sm"}`}>
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
  return (
    <div aria-live="polite">
      <dl>
        {row("Subtotal", formatMinor(calc.subtotal, currency))}
        {calc.discountTotal > 0 ? row("Discount", `−${formatMinor(calc.discountTotal, currency)}`) : null}
        {row("Tax", formatMinor(calc.taxTotal, currency))}
        {calc.shipping > 0 ? row("Shipping", formatMinor(calc.shipping, currency)) : null}
        {row("Total", formatMinor(calc.total, currency), true)}
      </dl>
      {calc.issues.map((m) => <p key={m} className="mt-2 text-xs text-warning">{m}</p>)}
    </div>
  );
}

export type BuilderProps = {
  mode: "create" | "edit";
  invoiceRef?: string;
  status: InvoiceStatusKey;
  initial: InvoiceFormValues;
  clients: ClientDTO[];
  products: ProductDTO[];
  templates: TemplateDTO[];
  logoUrl?: string | null;
  signatureUrl?: string | null;
  nextNumber: string;
  taxDefault: number;
};

export function InvoiceBuilder(props: BuilderProps) {
  const { mode, invoiceRef, status, clients, products, templates, logoUrl, signatureUrl, nextNumber, taxDefault } = props;
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pane, setPane] = React.useState<"edit" | "preview">("edit");
  const [intent, setIntent] = React.useState<"draft" | "send">("draft");

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema as never) as unknown as Resolver<InvoiceFormValues>,
    defaultValues: props.initial,
    mode: "onTouched",
  });
  const { register, control, handleSubmit, setValue, getValues, setError, formState } = form;
  const { errors, isSubmitting, isDirty } = formState;
  const currency = useWatch({ control, name: "currency" }) as string;
  const clientId = useWatch({ control, name: "clientId" });
  const paymentTerms = useWatch({ control, name: "paymentTerms" });

  React.useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const recalcDue = (issue: string, terms: number) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issue) || !Number.isFinite(terms)) return;
    setValue("dueDate", toDateInput(addDays(parseDateInput(issue), terms)), { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = handleSubmit(
    async (values) => {
      setFormError(null);
      const res = await saveInvoiceAction(invoiceRef ?? null, values);
      if (!res.ok) {
        setFormError(res.error ?? "Couldn't save the invoice");
        for (const [k, msg] of Object.entries(res.fieldErrors ?? {})) setError(k as never, { message: msg });
        toast.error(res.error ?? "Couldn't save the invoice");
        return;
      }
      if (intent === "send" && status === "DRAFT") {
        const s = await setStatusAction(res.data.ref, "SENT");
        if (!s.ok) toast.error(s.error ?? "Saved, but couldn't mark as sent");
      }
      form.reset(values);
      toast.success(mode === "create" ? "Invoice created" : "Invoice updated");
      router.push(`/invoices/${res.data.ref}`);
      router.refresh();
    },
    () => {
      setFormError("Please fix the highlighted fields.");
      toast.error("Some fields need your attention");
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
    },
  );

  const pickClient = (ref: string) => {
    setValue("clientId", ref || null, { shouldDirty: true });
    const c = clients.find((x) => x.id === ref);
    if (c) setValue("client", { name: c.name, company: c.company ?? undefined, email: c.email ?? undefined, phone: c.phone ?? undefined, taxId: c.taxId ?? undefined, address: c.address || undefined }, { shouldDirty: true, shouldValidate: true });
  };

  const termOptions = TERMS.includes(Number(paymentTerms)) ? TERMS : [...TERMS, Number(paymentTerms)].sort((a, b) => a - b);

  const details = (
    <div className="flex flex-col gap-4">
      <Section title="Your business" description="Printed at the top of the invoice. Edit defaults in Settings.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Business name" required error={errors.business?.name?.message} className="sm:col-span-2">{(p) => <Input {...p} autoComplete="organization" {...register("business.name")} />}</Field>
          <Field label="Email" error={errors.business?.email?.message}>{(p) => <Input {...p} type="email" {...register("business.email")} />}</Field>
          <Field label="Phone" error={errors.business?.phone?.message}>{(p) => <Input {...p} type="tel" {...register("business.phone")} />}</Field>
          <Field label="Website" error={errors.business?.website?.message}>{(p) => <Input {...p} type="url" placeholder="https://" {...register("business.website")} />}</Field>
          <Field label="Tax / VAT number" error={errors.business?.taxId?.message}>{(p) => <Input {...p} {...register("business.taxId")} />}</Field>
          <Field label="Address" error={errors.business?.address?.message} className="sm:col-span-2">{(p) => <Textarea {...p} rows={3} {...register("business.address")} />}</Field>
          <Field label="Payment information" hint="Bank details, mobile money, payment link…" error={errors.business?.paymentInfo?.message} className="sm:col-span-2">{(p) => <Textarea {...p} rows={3} {...register("business.paymentInfo")} />}</Field>
        </div>
      </Section>

      <Section title="Bill to">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Saved client" className="sm:col-span-2">
            {(p) => (
              <Select {...p} value={clientId ?? ""} onChange={(e) => pickClient(e.target.value)}>
                <option value="">{clients.length ? "New client (enter details below)" : "No saved clients yet"}</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Client name" required error={errors.client?.name?.message}>{(p) => <Input {...p} {...register("client.name")} />}</Field>
          <Field label="Company" error={errors.client?.company?.message}>{(p) => <Input {...p} {...register("client.company")} />}</Field>
          <Field label="Email" error={errors.client?.email?.message}>{(p) => <Input {...p} type="email" {...register("client.email")} />}</Field>
          <Field label="Phone" error={errors.client?.phone?.message}>{(p) => <Input {...p} type="tel" {...register("client.phone")} />}</Field>
          <Field label="Tax / VAT number" error={errors.client?.taxId?.message}>{(p) => <Input {...p} {...register("client.taxId")} />}</Field>
          <Field label="Address" error={errors.client?.address?.message} className="sm:col-span-2">{(p) => <Textarea {...p} rows={3} {...register("client.address")} />}</Field>
          {!clientId ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="size-4 accent-[var(--ring)]" {...register("saveClient")} />
              Save this client for next time
            </label>
          ) : null}
        </div>
      </Section>

      <Section title="Invoice details">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Invoice number" hint={`Leave blank to use ${nextNumber}`} error={errors.number?.message}>{(p) => <Input {...p} placeholder={nextNumber} {...register("number")} />}</Field>
          <Field label="Reference / PO number" error={errors.reference?.message}>{(p) => <Input {...p} {...register("reference")} />}</Field>
          <Field label="Issue date" required error={errors.issueDate?.message}>
            {(p) => <Input {...p} type="date" {...register("issueDate", { onChange: (e) => recalcDue(e.target.value, Number(getValues("paymentTerms"))) })} />}
          </Field>
          <Field label="Payment terms" error={errors.paymentTerms?.message}>
            {(p) => (
              <Select {...p} {...register("paymentTerms", { valueAsNumber: true, onChange: (e) => recalcDue(getValues("issueDate"), Number(e.target.value)) })}>
                {termOptions.map((t) => <option key={t} value={t}>{t === 0 ? "Due on receipt" : `Net ${t} days`}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Due date" required error={errors.dueDate?.message}>
            {(p) => (
              <Input
                {...p}
                type="date"
                {...register("dueDate", {
                  onChange: (e) => {
                    const a = Date.parse(`${getValues("issueDate")}T00:00:00Z`);
                    const b = Date.parse(`${e.target.value}T00:00:00Z`);
                    if (Number.isFinite(a) && Number.isFinite(b) && b >= a) setValue("paymentTerms", Math.round((b - a) / 86400000), { shouldDirty: true });
                  },
                })}
              />
            )}
          </Field>
          <Field label="Currency" error={errors.currency?.message}>
            {(p) => <Select {...p} {...register("currency")}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}</Select>}
          </Field>
        </div>
      </Section>

      <Section title="Items" description="Drag the handle to reorder. Quantities can be fractional.">
        <ItemsEditor control={control} register={register} errors={errors} currency={currency} products={products} taxDefault={taxDefault} />
      </Section>

      <Section title="Adjustments & totals">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Invoice discount" error={errors.discountValue?.message}>
            {(p) => (
              <div className="flex gap-2">
                <Input {...p} type="number" inputMode="decimal" min={0} step="any" {...register("discountValue", { valueAsNumber: true })} />
                <div className="w-28 shrink-0"><Select aria-label="Discount type" {...register("discountType")}><option value="PERCENT">%</option><option value="FIXED">{currency}</option></Select></div>
              </div>
            )}
          </Field>
          <Field label="Shipping / other charges" error={errors.shipping?.message}>
            {(p) => <Input {...p} type="number" inputMode="decimal" min={0} step="any" {...register("shipping", { valueAsNumber: true })} />}
          </Field>
        </div>
        <div className="mt-5 rounded-lg bg-muted/60 p-4"><Totals control={control} currency={currency} /></div>
      </Section>

      <Section title="Notes & terms">
        <div className="grid gap-3">
          <Field label="Notes" hint="Visible to your client, e.g. a thank-you message." error={errors.notes?.message}>{(p) => <Textarea {...p} rows={3} {...register("notes")} />}</Field>
          <Field label="Terms & conditions" error={errors.terms?.message}>{(p) => <Textarea {...p} rows={3} {...register("terms")} />}</Field>
        </div>
      </Section>
    </div>
  );

  const preview = <Preview control={control} status={status} logoUrl={logoUrl} signatureUrl={signatureUrl} nextNumber={mode === "create" ? nextNumber : (props.initial.number ?? nextNumber)} />;

  return (
    <form onSubmit={onSubmit} noValidate aria-label={mode === "create" ? "New invoice" : "Edit invoice"}>
      {/* Mobile: Edit / Preview switch */}
      <div className="sticky top-16 z-20 -mx-4 mb-4 border-b bg-background/90 px-4 py-2 backdrop-blur lg:hidden">
        <div role="tablist" aria-label="Builder view" className="grid grid-cols-2 gap-1 rounded-lg border bg-muted p-1">
          {([["edit", "Edit", Pencil], ["preview", "Preview", Eye]] as const).map(([k, label, Icon]) => (
            <button key={k} type="button" role="tab" aria-selected={pane === k} onClick={() => setPane(k)} className={`inline-flex h-9 items-center justify-center gap-2 rounded-md text-sm font-medium ${pane === k ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
              <Icon className="size-4" aria-hidden />{label}
            </button>
          ))}
        </div>
      </div>

      <FormError message={formError} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,540px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,580px)_minmax(0,1fr)]">
        <div className={pane === "edit" ? "" : "hidden lg:block"}>
          <Tabs defaultValue="details">
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="design">Design</TabsTrigger>
            </TabsList>
            <TabsContent value="details" forceMount className="data-[state=inactive]:hidden">{details}</TabsContent>
            <TabsContent value="design" forceMount className="data-[state=inactive]:hidden">
              <Card className="p-4 sm:p-5">
                <DesignPanel control={control} setValue={setValue} register={register} templates={templates} logoUrl={logoUrl} signatureUrl={signatureUrl} />
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        <div className={pane === "preview" ? "" : "hidden lg:block"}>
          <div className="lg:sticky lg:top-24">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Live preview</p>
            {preview}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center justify-between gap-3 border-t bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline" loading={isSubmitting && intent === "draft"} disabled={isSubmitting} onClick={() => setIntent("draft")}>
            <Save className="size-4" aria-hidden />{mode === "create" ? "Save draft" : status === "DRAFT" ? "Save draft" : "Save changes"}
          </Button>
          {status === "DRAFT" ? (
            <Button type="submit" loading={isSubmitting && intent === "send"} disabled={isSubmitting} onClick={() => setIntent("send")}>
              <Send className="size-4" aria-hidden />Save & mark as sent
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
