"use client";

import * as React from "react";
import { ScaledInvoice } from "@/components/invoice/scaled-invoice";
import { COLOR_PRESETS, DEFAULT_DESIGN } from "@/lib/design";
import { cn } from "@/lib/utils";
import { sampleView } from "./sample";

/** A real, editable invoice: the same renderer the product uses. */
export function HeroDemo() {
  const [client, setClient] = React.useState("Ada Mensah");
  const [qty, setQty] = React.useState(8);
  const [preset, setPreset] = React.useState(0);
  const p = COLOR_PRESETS[preset]!;
  const view = React.useMemo(
    () =>
      sampleView({
        client: { name: client || "Your client", company: "Globex Ltd", email: "ada@globex.com", address: "14 Spintex Road\nAccra, Ghana" },
        items: [
          { description: "Brand identity design", quantity: 1, unitPrice: 2400, taxRate: 0, discountRate: 0 },
          { description: "Website design (pages)", quantity: Math.max(0, qty || 0), unitPrice: 320, taxRate: 0, discountRate: 10 },
          { description: "Monthly hosting & support", quantity: 3, unitPrice: 49, taxRate: 0, discountRate: 0 },
        ],
        design: { ...DEFAULT_DESIGN, brandColor: p.brand, accentColor: p.accent, footerText: "Northwind Studio · billing@northwind.studio" },
      }),
    [client, qty, p],
  );
  return (
    <div className="rounded-xl border bg-card p-3 shadow-card sm:p-4">
      <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_96px_auto] sm:items-end">
        <div>
          <label htmlFor="demo-client" className="mb-1 block text-xs font-medium text-muted-foreground">Client</label>
          <input id="demo-client" value={client} maxLength={40} onChange={(e) => setClient(e.target.value)} className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" />
        </div>
        <div>
          <label htmlFor="demo-qty" className="mb-1 block text-xs font-medium text-muted-foreground">Pages</label>
          <input id="demo-qty" type="number" min={0} max={99} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" />
        </div>
        <div role="group" aria-label="Brand colour" className="flex gap-1.5 pb-0.5">
          {COLOR_PRESETS.slice(0, 5).map((c, i) => (
            <button key={c.name} type="button" aria-label={c.name} aria-pressed={preset === i} onClick={() => setPreset(i)} className={cn("size-7 rounded-full border-2", preset === i ? "border-foreground" : "border-transparent ring-1 ring-border")} style={{ background: c.brand }} />
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border bg-white"><ScaledInvoice view={view} id="hero-invoice" /></div>
    </div>
  );
}
