"use client";

import * as React from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { Copy, GripVertical, PackageSearch, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { calculateInvoice } from "@/lib/invoice-calc";
import { formatAmount, formatMinor } from "@/lib/money";
import type { InvoiceFormValues } from "@/lib/invoice-form";
import type { ProductDTO } from "@/lib/services/products";

function ItemRow({
  id,
  index,
  control,
  register,
  errors,
  currency,
  onDuplicate,
  onRemove,
  canRemove,
}: {
  id: string;
  index: number;
  control: Control<InvoiceFormValues>;
  register: UseFormRegister<InvoiceFormValues>;
  errors: FieldErrors<InvoiceFormValues>;
  currency: string;
  onDuplicate: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const values = useWatch({ control });
  const calc = React.useMemo(
    () => calculateInvoice({ currency, items: (values.items ?? []).map((i) => ({ quantity: Number(i?.quantity) || 0, unitPrice: Number(i?.unitPrice) || 0, taxRate: Number(i?.taxRate) || 0, discountRate: Number(i?.discountRate) || 0 })) }),
    [values.items, currency],
  );
  const net = calc.lines[index]?.net ?? 0;
  const e = errors.items?.[index];
  const n = (name: "quantity" | "unitPrice" | "taxRate" | "discountRate") => register(`items.${index}.${name}`, { valueAsNumber: true });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border bg-card p-3 sm:p-4 ${isDragging ? "relative z-10 shadow-card ring-2 ring-primary" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="mt-1 inline-flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
          aria-label={`Reorder item ${index + 1}. Press space, then use arrow keys to move.`}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <Field label={`Item ${index + 1} description`} labelHidden error={e?.description?.message}>
            {(p) => <Textarea {...p} rows={2} placeholder="Description of product or service" className="min-h-[60px]" {...register(`items.${index}.description`)} />}
          </Field>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Qty" error={e?.quantity?.message}>
              {(p) => <Input {...p} type="number" inputMode="decimal" min={0} step="any" {...n("quantity")} />}
            </Field>
            <Field label="Unit price" error={e?.unitPrice?.message}>
              {(p) => <Input {...p} type="number" inputMode="decimal" min={0} step="any" {...n("unitPrice")} />}
            </Field>
            <Field label="Tax %" error={e?.taxRate?.message}>
              {(p) => <Input {...p} type="number" inputMode="decimal" min={0} max={100} step="any" {...n("taxRate")} />}
            </Field>
            <Field label="Discount %" error={e?.discountRate?.message}>
              {(p) => <Input {...p} type="number" inputMode="decimal" min={0} max={100} step="any" {...n("discountRate")} />}
            </Field>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={onDuplicate}><Copy className="size-4" aria-hidden /><span className="sr-only sm:not-sr-only">Duplicate</span><span className="sr-only"> item {index + 1}</span></Button>
              <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={!canRemove} className="text-destructive hover:bg-destructive-soft"><Trash2 className="size-4" aria-hidden /><span className="sr-only sm:not-sr-only">Delete</span><span className="sr-only"> item {index + 1}</span></Button>
            </div>
            <p className="text-right text-sm"><span className="text-muted-foreground">Total </span><span className="tabular font-semibold">{formatMinor(net, currency)}</span></p>
          </div>
        </div>
      </div>
    </li>
  );
}

export function ItemsEditor({ control, register, errors, currency, products, taxDefault }: { control: Control<InvoiceFormValues>; register: UseFormRegister<InvoiceFormValues>; errors: FieldErrors<InvoiceFormValues>; currency: string; products: ProductDTO[]; taxDefault: number }) {
  const { fields, append, insert, remove, move, replace } = useFieldArray({ control, name: "items" });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const [catalog, setCatalog] = React.useState(false);
  const [q, setQ] = React.useState("");
  const items = useWatch({ control, name: "items" });

  const onDragEnd = (ev: DragEndEvent) => {
    if (!ev.over || ev.active.id === ev.over.id) return;
    move(fields.findIndex((f) => f.id === ev.active.id), fields.findIndex((f) => f.id === ev.over!.id));
  };

  const blank = { productId: null, description: "", quantity: 1, unitPrice: 0, taxRate: taxDefault, discountRate: 0 };
  const filtered = products.filter((p) => !q || `${p.name} ${p.sku ?? ""} ${p.description ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-3" aria-label="Invoice line items">
            {fields.map((f, i) => (
              <ItemRow
                key={f.id}
                id={f.id}
                index={i}
                control={control}
                register={register}
                errors={errors}
                currency={currency}
                canRemove={fields.length > 1}
                onRemove={() => remove(i)}
                onDuplicate={() => {
                  const src = items?.[i];
                  if (src) insert(i + 1, { ...src });
                }}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {errors.items?.root?.message || (typeof errors.items?.message === "string" && errors.items.message) ? (
        <p role="alert" className="mt-2 text-xs font-medium text-destructive">{errors.items?.root?.message ?? (errors.items?.message as string)}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => append(blank)}><Plus className="size-4" aria-hidden />Add item</Button>
        <Button type="button" variant="outline" onClick={() => setCatalog(true)} disabled={products.length === 0} title={products.length === 0 ? "Add products in Products & Services first" : undefined}>
          <PackageSearch className="size-4" aria-hidden />Add from catalog
        </Button>
      </div>

      <Dialog open={catalog} onOpenChange={setCatalog}>
        <DialogContent title="Add from catalog" description="Search your saved products and services.">
          <label htmlFor="catalog-q" className="sr-only">Search catalog</label>
          <Input id="catalog-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or SKU…" autoFocus />
          <ul className="mt-3 flex max-h-[50dvh] flex-col gap-1 overflow-y-auto">
            {filtered.length === 0 ? <li className="py-8 text-center text-sm text-muted-foreground">No matching products.</li> : null}
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left hover:bg-muted"
                  onClick={() => {
                    const row = { productId: p.id, description: p.description ? `${p.name} — ${p.description}` : p.name, quantity: 1, unitPrice: p.unitPrice, taxRate: p.taxRate, discountRate: 0 };
                    const only = items?.length === 1 && !items[0]?.description && !Number(items[0]?.unitPrice);
                    if (only) replace([row]);
                    else append(row);
                    setCatalog(false);
                    setQ("");
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.sku ? `SKU ${p.sku}` : p.description ?? ""}</span>
                  </span>
                  <span className="tabular shrink-0 text-sm font-medium">{formatAmount(p.unitPrice, p.currency)}</span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
