"use client";

import * as React from "react";
import { InvoiceDocument } from "./invoice-document";
import type { InvoiceView } from "@/lib/invoice-view";

const PAGE_W = 794;

/**
 * Renders the real invoice document at its native width and scales it to fit the container,
 * so the preview is pixel-faithful on a phone, a tablet and a desktop.
 */
export function ScaledInvoice({ view, id, className }: { view: InvoiceView; id?: string; className?: string }) {
  const outer = React.useRef<HTMLDivElement>(null);
  const inner = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.6);
  const [height, setHeight] = React.useState(1123 * 0.6);

  React.useLayoutEffect(() => {
    const el = outer.current;
    const doc = inner.current;
    if (!el || !doc) return;
    const measure = () => {
      const s = Math.min(1, el.clientWidth / PAGE_W);
      setScale(s);
      setHeight(doc.offsetHeight * s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(doc);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outer} className={className} style={{ width: "100%", height }}>
      <div ref={inner} style={{ width: PAGE_W, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <InvoiceDocument view={view} id={id} />
      </div>
    </div>
  );
}
