import { ScaledInvoice } from "@/components/invoice/scaled-invoice";
import { sampleView } from "./sample";

export function InvoiceMini() {
  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <ScaledInvoice view={sampleView()} id="invoice-mini" />
    </div>
  );
}
