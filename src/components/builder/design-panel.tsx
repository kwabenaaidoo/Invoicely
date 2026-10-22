"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, type Control, type UseFormSetValue, type UseFormRegister, useWatch } from "react-hook-form";
import { Check, Save } from "lucide-react";
import { toast } from "sonner";
import { COLOR_PRESETS, FONTS, LAYOUTS, type Design } from "@/lib/design";
import { cn } from "@/lib/utils";
import { Field, Input, Select } from "@/components/ui/form";
import { SwitchField } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { saveTemplateAction } from "@/lib/actions/templates";
import type { TemplateDTO } from "@/lib/services/templates";
import type { InvoiceFormValues } from "@/lib/invoice-form";
import { ImageUploader } from "./logo-uploader";

const LAYOUT_LABEL: Record<(typeof LAYOUTS)[number], string> = { MODERN: "Modern", MINIMAL: "Minimal", CORPORATE: "Corporate", CLASSIC: "Classic" };
const TOGGLES: { key: keyof Design["show"]; label: string }[] = [
  { key: "logo", label: "Logo" },
  { key: "taxNumber", label: "Tax numbers" },
  { key: "paymentTerms", label: "Payment terms" },
  { key: "notes", label: "Notes" },
  { key: "bankInfo", label: "Bank / payment info" },
  { key: "signature", label: "Signature" },
  { key: "footer", label: "Footer" },
];

export function DesignPanel({
  control,
  setValue,
  register,
  templates,
  logoUrl,
  signatureUrl,
}: {
  control: Control<InvoiceFormValues>;
  setValue: UseFormSetValue<InvoiceFormValues>;
  register: UseFormRegister<InvoiceFormValues>;
  templates: TemplateDTO[];
  logoUrl?: string | null;
  signatureUrl?: string | null;
}) {
  const router = useRouter();
  const design = useWatch({ control, name: "design" }) as Design;
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const apply = (t: TemplateDTO) => {
    setValue("design", t.design, { shouldDirty: true });
    setValue("templateId", t.id, { shouldDirty: true });
  };
  const patch = <K extends keyof Design>(key: K, value: Design[K]) => setValue(`design.${key}` as never, value as never, { shouldDirty: true });

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="tpl">
        <h3 id="tpl" className="mb-2 text-[13px] font-semibold">Template</h3>
        <div className="grid grid-cols-2 gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => apply(t)}
              className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2.5 text-left text-sm hover:bg-muted"
            >
              <span className="flex min-w-0 items-center gap-2"><span aria-hidden className="size-3 shrink-0 rounded-full border" style={{ background: t.design.brandColor }} /><span className="truncate">{t.name}</span></span>
              {t.isDefault ? <span className="text-[10px] font-semibold uppercase text-muted-foreground">Default</span> : null}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="lay">
        <h3 id="lay" className="mb-2 text-[13px] font-semibold">Layout</h3>
        <div role="radiogroup" aria-labelledby="lay" className="grid grid-cols-2 gap-2">
          {LAYOUTS.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={design.layout === l}
              onClick={() => patch("layout", l)}
              className={cn("flex h-10 items-center justify-between rounded-md border px-3 text-sm font-medium", design.layout === l ? "border-primary bg-accent-soft text-accent-soft-foreground ring-1 ring-primary" : "bg-card hover:bg-muted")}
            >
              {LAYOUT_LABEL[l]}
              {design.layout === l ? <Check className="size-4" aria-hidden /> : null}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="col" className="flex flex-col gap-3">
        <h3 id="col" className="text-[13px] font-semibold">Colours</h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Colour presets">
          {COLOR_PRESETS.map((c) => {
            const active = design.brandColor.toLowerCase() === c.brand;
            return (
              <button
                key={c.name}
                type="button"
                title={c.name}
                aria-label={`${c.name} preset`}
                aria-pressed={active}
                onClick={() => {
                  patch("brandColor", c.brand);
                  patch("accentColor", c.accent);
                }}
                className={cn("relative size-9 rounded-full border-2 transition-transform hover:scale-105", active ? "border-foreground" : "border-transparent ring-1 ring-border")}
                style={{ background: c.brand }}
              >
                {active ? <Check className="absolute inset-0 m-auto size-4 text-white mix-blend-difference" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand colour">
            {(p) => (
              <div className="flex items-center gap-2">
                <input {...p} type="color" value={design.brandColor} onChange={(e) => patch("brandColor", e.target.value)} className="h-10 w-12 cursor-pointer rounded-md border border-input bg-card p-1" />
                <span className="tabular font-mono text-xs text-muted-foreground">{design.brandColor}</span>
              </div>
            )}
          </Field>
          <Field label="Accent colour">
            {(p) => (
              <div className="flex items-center gap-2">
                <input {...p} type="color" value={design.accentColor} onChange={(e) => patch("accentColor", e.target.value)} className="h-10 w-12 cursor-pointer rounded-md border border-input bg-card p-1" />
                <span className="tabular font-mono text-xs text-muted-foreground">{design.accentColor}</span>
              </div>
            )}
          </Field>
        </div>
      </section>

      <section aria-labelledby="typ">
        <Field label="Typography">
          {(p) => (
            <Select {...p} value={design.font} onChange={(e) => patch("font", e.target.value as Design["font"])}>
              {Object.entries(FONTS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
            </Select>
          )}
        </Field>
      </section>

      <section aria-labelledby="els">
        <h3 id="els" className="mb-1 text-[13px] font-semibold">Show on invoice</h3>
        <div className="divide-y">
          {TOGGLES.map((t) => (
            <Controller
              key={t.key}
              control={control}
              name={`design.show.${t.key}` as never}
              render={({ field }) => <SwitchField label={t.label} checked={!!field.value} onCheckedChange={field.onChange} />}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Field label="Footer text" hint="Appears at the bottom of every page.">
          {(p) => <Input {...p} maxLength={500} {...register("design.footerText")} />}
        </Field>
        <div>
          <p className="mb-2 text-[13px] font-medium">Logo</p>
          <ImageUploader kind="logos" url={logoUrl} label="Logo" />
        </div>
        {design.show.signature ? (
          <div>
            <p className="mb-2 text-[13px] font-medium">Signature</p>
            <ImageUploader kind="signatures" url={signatureUrl} label="Signature" />
          </div>
        ) : null}
      </section>

      <Button type="button" variant="outline" onClick={() => setSaveOpen(true)}><Save className="size-4" aria-hidden />Save as template</Button>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent title="Save as template" description="Reuse this design on future invoices.">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              const res = await saveTemplateAction(null, { name, design });
              setSaving(false);
              if (res.ok) {
                toast.success("Template saved");
                setSaveOpen(false);
                setName("");
                router.refresh();
              } else toast.error(res.fieldErrors?.name ?? res.error ?? "Couldn't save the template");
            }}
          >
            <Field label="Template name" required>
              {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus placeholder="e.g. Agency retainer" />}
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
              <Button type="submit" loading={saving} disabled={!name.trim()}>Save template</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
