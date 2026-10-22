"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { ThemeSelector } from "@/components/ui/theme";
import { ImageUploader } from "@/components/builder/logo-uploader";
import { CURRENCIES } from "@/lib/money";
import { businessSchema, changePasswordSchema, invoiceSettingsSchema, profileSchema } from "@/lib/validators";
import { changePassword } from "@/lib/actions/auth";
import { deleteAccountAction, revokeOtherSessionsAction, revokeSessionAction, updateBusinessAction, updateInvoiceSettingsAction, updateProfileAction } from "@/lib/actions/settings";
import type { ActionResult } from "@/lib/actions/util";
import { formatDate } from "@/lib/utils";

function useSave<T extends Record<string, unknown>>(schema: unknown, defaults: T, action: (v: unknown) => Promise<ActionResult>, success: string, after?: () => void) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<T>({ resolver: zodResolver(schema as never) as unknown as Resolver<T>, defaultValues: defaults as never });
  const submit = form.handleSubmit(async (v) => {
    setError(null);
    const res = await action(v);
    if (!res.ok) {
      setError(res.error ?? "Couldn't save");
      for (const [k, m] of Object.entries(res.fieldErrors ?? {})) form.setError(k as never, { message: m });
      return;
    }
    toast.success(success);
    form.reset(v);
    after?.();
    router.refresh();
  });
  return { form, error, submit };
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </Card>
  );
}

export function ProfileForm({ defaults, verified }: { defaults: { name: string; email: string }; verified: boolean }) {
  const { form, error, submit } = useSave(profileSchema, defaults, updateProfileAction, "Profile updated");
  const { register, formState: { errors, isSubmitting, isDirty } } = form;
  return (
    <Panel title="Profile">
      <form onSubmit={submit} noValidate className="grid max-w-xl gap-4">
        <FormError message={error} />
        <Field label="Full name" required error={errors.name?.message}>{(p) => <Input {...p} autoComplete="name" {...register("name")} />}</Field>
        <Field label="Email" required error={errors.email?.message} hint={verified ? "Verified. Changing it requires re-verification." : "Not verified yet."}>{(p) => <Input {...p} type="email" autoComplete="email" {...register("email")} />}</Field>
        <div><Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save profile</Button></div>
      </form>
    </Panel>
  );
}

type Biz = { name: string; email?: string; phone?: string; website?: string; taxId?: string; addressLine1?: string; addressLine2?: string; city?: string; region?: string; postalCode?: string; country?: string; paymentInfo?: string };

export function BusinessForm({ defaults, logoUrl, signatureUrl }: { defaults: Biz; logoUrl: string | null; signatureUrl: string | null }) {
  const { form, error, submit } = useSave(businessSchema, defaults, updateBusinessAction, "Business details saved");
  const { register, formState: { errors, isSubmitting, isDirty } } = form;
  return (
    <Panel title="Business" description="Used as the default sender on new invoices. Past invoices keep the details they were issued with.">
      <div className="mb-6 grid gap-5 sm:grid-cols-2">
        <div><p className="mb-2 text-[13px] font-medium">Logo</p><ImageUploader kind="logos" url={logoUrl} label="Logo" /></div>
        <div><p className="mb-2 text-[13px] font-medium">Signature</p><ImageUploader kind="signatures" url={signatureUrl} label="Signature" /></div>
      </div>
      <form onSubmit={submit} noValidate className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><FormError message={error} /></div>
        <Field label="Business name" required className="sm:col-span-2" error={errors.name?.message}>{(p) => <Input {...p} {...register("name")} />}</Field>
        <Field label="Email" error={errors.email?.message}>{(p) => <Input {...p} type="email" {...register("email")} />}</Field>
        <Field label="Phone" error={errors.phone?.message}>{(p) => <Input {...p} type="tel" {...register("phone")} />}</Field>
        <Field label="Website" error={errors.website?.message}>{(p) => <Input {...p} type="url" placeholder="https://" {...register("website")} />}</Field>
        <Field label="Tax / VAT number" error={errors.taxId?.message}>{(p) => <Input {...p} {...register("taxId")} />}</Field>
        <Field label="Address line 1" className="sm:col-span-2" error={errors.addressLine1?.message}>{(p) => <Input {...p} {...register("addressLine1")} />}</Field>
        <Field label="Address line 2" className="sm:col-span-2" error={errors.addressLine2?.message}>{(p) => <Input {...p} {...register("addressLine2")} />}</Field>
        <Field label="City" error={errors.city?.message}>{(p) => <Input {...p} {...register("city")} />}</Field>
        <Field label="State / region" error={errors.region?.message}>{(p) => <Input {...p} {...register("region")} />}</Field>
        <Field label="Postal code" error={errors.postalCode?.message}>{(p) => <Input {...p} {...register("postalCode")} />}</Field>
        <Field label="Country" error={errors.country?.message}>{(p) => <Input {...p} {...register("country")} />}</Field>
        <Field label="Payment information" hint="Shown on invoices: bank details, mobile money, payment links." className="sm:col-span-2" error={errors.paymentInfo?.message}>{(p) => <Textarea {...p} rows={4} {...register("paymentInfo")} />}</Field>
        <div className="sm:col-span-2"><Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save business</Button></div>
      </form>
    </Panel>
  );
}

type Inv = { defaultCurrency: string; invoicePrefix: string; invoiceNumberPadding: number; nextInvoiceNumber: number; defaultPaymentTerms: number; defaultTaxRate: number; defaultNotes?: string; defaultFooter?: string };

export function InvoiceSettingsForm({ defaults }: { defaults: Inv }) {
  const { form, error, submit } = useSave(invoiceSettingsSchema, defaults, updateInvoiceSettingsAction, "Invoice settings saved");
  const { register, watch, formState: { errors, isSubmitting, isDirty } } = form;
  const w = watch() as Inv;
  const preview = `${w.invoicePrefix ?? ""}${String(Number(w.nextInvoiceNumber) || 1).padStart(Number(w.invoiceNumberPadding) || 1, "0")}`;
  const n = (name: keyof Inv) => register(name as never, { valueAsNumber: true });
  return (
    <Panel title="Invoice settings" description="Defaults applied to every new invoice. Default template is chosen on the Templates page.">
      <form onSubmit={submit} noValidate className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><FormError message={error} /></div>
        <Field label="Default currency" error={errors.defaultCurrency?.message}>{(p) => <Select {...p} {...register("defaultCurrency")}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}</Select>}</Field>
        <Field label="Default payment terms (days)" error={errors.defaultPaymentTerms?.message}>{(p) => <Input {...p} type="number" min={0} max={365} {...n("defaultPaymentTerms")} />}</Field>
        <Field label="Default tax %" error={errors.defaultTaxRate?.message}>{(p) => <Input {...p} type="number" min={0} max={100} step="any" {...n("defaultTaxRate")} />}</Field>
        <div className="hidden sm:block" />
        <Field label="Number prefix" error={errors.invoicePrefix?.message}>{(p) => <Input {...p} maxLength={12} {...register("invoicePrefix")} />}</Field>
        <Field label="Digits (padding)" error={errors.invoiceNumberPadding?.message}>{(p) => <Input {...p} type="number" min={1} max={10} {...n("invoiceNumberPadding")} />}</Field>
        <Field label="Next number" error={errors.nextInvoiceNumber?.message} hint={`Next invoice will be ${preview}`}>{(p) => <Input {...p} type="number" min={1} {...n("nextInvoiceNumber")} />}</Field>
        <Field label="Default notes" className="sm:col-span-2" error={errors.defaultNotes?.message}>{(p) => <Textarea {...p} rows={3} {...register("defaultNotes")} />}</Field>
        <Field label="Default footer" className="sm:col-span-2" error={errors.defaultFooter?.message}>{(p) => <Input {...p} {...register("defaultFooter")} />}</Field>
        <div className="sm:col-span-2"><Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save invoice settings</Button></div>
      </form>
    </Panel>
  );
}

export function AppearancePanel() {
  return (
    <Panel title="Appearance" description="Choose how Invoicely looks. Your choice is remembered on this device.">
      <div className="max-w-md"><ThemeSelector /></div>
    </Panel>
  );
}

export type SessionRow = { id: string; device: string; ip: string | null; lastUsed: string; current: boolean };

export function SecurityPanel({ sessions, hasPassword }: { sessions: SessionRow[]; hasPassword: boolean }) {
  const router = useRouter();
  const clear = React.useRef<() => void>(() => {});
  const pw = useSave(changePasswordSchema, { currentPassword: "", password: "", confirmPassword: "" }, changePassword, "Password changed", () => clear.current());
  React.useEffect(() => {
    clear.current = () => pw.form.reset({ currentPassword: "", password: "", confirmPassword: "" });
  });
  const { register, formState: { errors, isSubmitting } } = pw.form;
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const del = useForm<{ password: string; confirm: string }>({ defaultValues: { password: "", confirm: "" } });
  const [delError, setDelError] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Change password" description="Changing your password signs you out on other devices.">
        <form onSubmit={pw.submit} noValidate className="grid max-w-md gap-4">
          <FormError message={pw.error} />
          <Field label="Current password" required error={errors.currentPassword?.message}>{(p) => <Input {...p} type="password" autoComplete="current-password" {...register("currentPassword")} />}</Field>
          <Field label="New password" required hint="At least 10 characters, with a letter and a number." error={errors.password?.message}>{(p) => <Input {...p} type="password" autoComplete="new-password" {...register("password")} />}</Field>
          <Field label="Confirm new password" required error={errors.confirmPassword?.message}>{(p) => <Input {...p} type="password" autoComplete="new-password" {...register("confirmPassword")} />}</Field>
          <div><Button type="submit" loading={isSubmitting}>Update password</Button></div>
        </form>
      </Panel>

      <Panel title="Active sessions" description="Devices currently signed in to your account.">
        <ul className="divide-y rounded-lg border">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.device}{s.current ? <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold uppercase text-accent-soft-foreground">This device</span> : null}</p>
                <p className="text-xs text-muted-foreground">{s.ip ?? "Unknown IP"} · last active {formatDate(s.lastUsed)}</p>
              </div>
              {!s.current ? <Button size="sm" variant="outline" onClick={async () => { await revokeSessionAction(s.id); toast.success("Session signed out"); router.refresh(); }}>Sign out</Button> : null}
            </li>
          ))}
        </ul>
        {sessions.length > 1 ? <Button variant="outline" className="mt-3" onClick={async () => { await revokeOtherSessionsAction(); toast.success("Signed out everywhere else"); router.refresh(); }}>Sign out all other devices</Button> : null}
      </Panel>

      <Panel title="Delete account" description="Permanently deletes your account, invoices, clients, API keys and uploaded files. This can't be undone.">
        <Button variant="destructive" onClick={() => setConfirm(true)} disabled={!hasPassword}>Delete my account</Button>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Delete your account?"
          description="Enter your password and type DELETE to confirm."
          confirmLabel="Delete account"
          loading={busy}
          onConfirm={async () => {
            setBusy(true);
            setDelError(null);
            const res = await deleteAccountAction(del.getValues());
            setBusy(false);
            if (res && !res.ok) setDelError(res.fieldErrors?.password ?? res.fieldErrors?.confirm ?? res.error ?? "Couldn't delete the account");
          }}
        />
        {confirm ? (
          <div className="mt-4 grid max-w-sm gap-3" role="group" aria-label="Confirm account deletion">
            <FormError message={delError} />
            <Field label="Password" required>{(p) => <Input {...p} type="password" autoComplete="current-password" {...del.register("password")} />}</Field>
            <Field label="Type DELETE" required>{(p) => <Input {...p} autoComplete="off" {...del.register("confirm")} />}</Field>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
