"use client";

import * as React from "react";
import { Printer } from "lucide-react";

/** Opens the print dialog once the invoice (and its fonts) have rendered. The button is hidden when printing. */
export function PrintTrigger() {
  React.useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="print:hidden fixed right-4 top-4 z-10">
      <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-soft">
        <Printer className="size-4" aria-hidden />Print
      </button>
    </div>
  );
}
