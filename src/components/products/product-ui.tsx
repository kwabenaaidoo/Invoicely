"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { CURRENCIES, formatAmount } from "@/lib/money";
import { productSchema, type ProductInput } from "@/lib/validators";
import { deleteProductAction, saveProductAction } from "@/lib/actions/products";
import type { ProductDTO } from "@/lib/services/products";

export function ProductFormDialog({ product, open, onOpenChange, defaultCurrency }: { product?: ProductDTO; open: boolean; onOpenChange: (o: boolean) => void; defaultCurrency: string }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const values = (): ProductInput => ({
    name: product?.name ?? "", description: product?.description ?? "", sku: product?.sku ?? "",
    unitPrice: product?.unitPrice ?? 0, taxRate: product?.taxRate ?? 0, currency: (product?.currency ?? defaultCurrency) as ProductInput["currency"],
  });
  const form = useForm<ProductInput>({ resolver: zodResolver(productSchema as never) as unknown as Resolver<ProductInput>, defaultValues: values() });
  const { register, handleSubmit, reset, setError: setFieldError, formState: { errors, isSubmitting } } = form;
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (open) { reset(values()); setError(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const submit = handleSubmit(async (v) => {
    setError(null);
    const res = await saveProductAction(product?.id ?? null, v);
    if (!res.ok) {
      setError(res.error ?? "Couldn't save");
      for (const [k, m] of Object.entries(res.fieldErrors ?? {})) setFieldError(k as never, { message: m });
      return;
    }
    toast.success(product ? "Product updated" : "Product added");
    onOpenChange(false);
    router.refresh();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={product ? "Edit product or service" : "Add product or service"} description="Reusable items you can add to any invoice.">
        <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><FormError message={error} /></div>
          <Field label="Name" required className="sm:col-span-2" error={errors.name?.message}>{(p) => <Input {...p} autoFocus {...register("name")} />}</Field>
          <Field label="Description" className="sm:col-span-2" error={errors.description?.message}>{(p) => <Textarea {...p} rows={2} {...register("description")} />}</Field>
          <Field label="SKU" error={errors.sku?.message}>{(p) => <Input {...p} {...register("sku")} />}</Field>
          <Field label="Currency" error={errors.currency?.message}>{(p) => <Select {...p} {...register("currency")}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</Select>}</Field>
          <Field label="Unit price" required error={errors.unitPrice?.message}>{(p) => <Input {...p} type="number" inputMode="decimal" min={0} step="any" {...register("unitPrice", { valueAsNumber: true })} />}</Field>
          <Field label="Tax %" error={errors.taxRate?.message}>{(p) => <Input {...p} type="number" inputMode="decimal" min={0} max={100} step="any" {...register("taxRate", { valueAsNumber: true })} />}</Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{product ? "Save changes" : "Add product"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddProductButton({ defaultCurrency }: { defaultCurrency: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Add product</Button>
      <ProductFormDialog open={open} onOpenChange={setOpen} defaultCurrency={defaultCurrency} />
    </>
  );
}

export function ProductRow({ product, defaultCurrency, variant }: { product: ProductDTO; defaultCurrency: string; variant: "row" | "card" }) {
  const router = useRouter();
  const [edit, setEdit] = React.useState(false);
  const [del, setDel] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const menu = (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label={`Actions for ${product.name}`}><MoreHorizontal className="size-[18px]" aria-hidden /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setEdit(true)}><Pencil aria-hidden />Edit</DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => setDel(true)}><Trash2 aria-hidden />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProductFormDialog product={product} open={edit} onOpenChange={setEdit} defaultCurrency={defaultCurrency} />
      <ConfirmDialog
        open={del}
        onOpenChange={setDel}
        title={`Delete ${product.name}?`}
        description="Existing invoices that used it are not affected."
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          const res = await deleteProductAction(product.id);
          setBusy(false);
          if (res.ok) { toast.success("Product deleted"); setDel(false); router.refresh(); } else toast.error(res.error ?? "Couldn't delete");
        }}
      />
    </>
  );
  if (variant === "card") {
    return (
      <li className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0"><p className="font-semibold">{product.name}</p><p className="truncate text-sm text-muted-foreground">{product.sku ? `SKU ${product.sku}` : product.description ?? ""}</p></div>
          {menu}
        </div>
        <p className="tabular mt-2 text-lg font-semibold">{formatAmount(product.unitPrice, product.currency)}<span className="ml-2 text-xs font-normal text-muted-foreground">{product.taxRate}% tax</span></p>
      </li>
    );
  }
  return (
    <tr className="hover:bg-muted/40">
      <td className="px-4 py-3"><div className="font-medium">{product.name}</div>{product.description ? <div className="max-w-sm truncate text-xs text-muted-foreground">{product.description}</div> : null}</td>
      <td className="px-4 py-3 text-muted-foreground">{product.sku ?? "—"}</td>
      <td className="tabular px-4 py-3 text-right font-medium">{formatAmount(product.unitPrice, product.currency)}</td>
      <td className="tabular px-4 py-3 text-right text-muted-foreground">{product.taxRate}%</td>
      <td className="px-2 py-2">{menu}</td>
    </tr>
  );
}
