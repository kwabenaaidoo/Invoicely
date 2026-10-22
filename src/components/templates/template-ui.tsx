"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { ScaledInvoice } from "@/components/invoice/scaled-invoice";
import { deleteTemplateAction, saveTemplateAction, setDefaultTemplateAction } from "@/lib/actions/templates";
import type { TemplateDTO } from "@/lib/services/templates";
import type { InvoiceView } from "@/lib/invoice-view";

export function TemplateCard({ t, view }: { t: TemplateDTO; view: InvoiceView }) {
  const router = useRouter();
  const [preview, setPreview] = React.useState(false);
  const [rename, setRename] = React.useState(false);
  const [name, setName] = React.useState(t.name);
  const [del, setDel] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const v = { ...view, design: t.design };
  return (
    <li className="flex flex-col overflow-hidden rounded-lg border bg-card">
      <button type="button" onClick={() => setPreview(true)} className="relative block h-56 overflow-hidden border-b bg-muted/50 p-3 text-left" aria-label={`Preview ${t.name} template`}>
        <div className="pointer-events-none origin-top overflow-hidden rounded border bg-white shadow-soft"><ScaledInvoice view={v} id={`tpl-${t.id}`} /></div>
      </button>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">{t.name}</h3>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
            {t.isDefault ? <span className="inline-flex items-center gap-1 rounded bg-accent-soft px-1.5 py-0.5 text-accent-soft-foreground"><Check className="size-3" aria-hidden />Default</span> : null}
            <span>{t.isSystem ? "Built-in" : "Custom"}</span>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setPreview(true)}><Eye className="size-4" aria-hidden />Preview</Button>
          {!t.isDefault ? (
            <Button size="sm" variant="outline" loading={busy === "def"} onClick={async () => { setBusy("def"); const r = await setDefaultTemplateAction(t.id); setBusy(null); if (r.ok) { toast.success(`${t.name} is now your default`); router.refresh(); } else toast.error(r.error ?? "Couldn't set default"); }}><Star className="size-4" aria-hidden />Set default</Button>
          ) : null}
          {!t.isSystem ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setRename(true)}><Pencil className="size-4" aria-hidden />Rename</Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive-soft" onClick={() => setDel(true)}><Trash2 className="size-4" aria-hidden />Delete</Button>
            </>
          ) : null}
        </div>
      </div>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent title={`${t.name} template`} description="Preview with sample data. Choose it when creating an invoice, then customise colours, font and elements." className="max-w-3xl">
          <div className="overflow-hidden rounded border bg-white"><ScaledInvoice view={v} id={`tpl-prev-${t.id}`} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setPreview(false)}>Close</Button><Button asChild><Link href="/invoices/new">Use for a new invoice</Link></Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rename} onOpenChange={setRename}>
        <DialogContent title="Rename template">
          <form onSubmit={async (e) => { e.preventDefault(); setBusy("ren"); const r = await saveTemplateAction(t.id, { name, design: t.design }); setBusy(null); if (r.ok) { toast.success("Template renamed"); setRename(false); router.refresh(); } else toast.error(r.fieldErrors?.name ?? r.error ?? "Couldn't rename"); }}>
            <Field label="Name" required>{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />}</Field>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setRename(false)}>Cancel</Button><Button type="submit" loading={busy === "ren"} disabled={!name.trim()}>Save</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={del} onOpenChange={setDel} title={`Delete ${t.name}?`} description="Invoices already using it keep their design." loading={busy === "del"} onConfirm={async () => { setBusy("del"); const r = await deleteTemplateAction(t.id); setBusy(null); if (r.ok) { toast.success("Template deleted"); setDel(false); router.refresh(); } else toast.error(r.error ?? "Couldn't delete"); }} />
    </li>
  );
}
