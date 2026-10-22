"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Download, Eye, Link2, MoreHorizontal, Pencil, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/dialog";
import { deleteInvoiceAction, duplicateInvoiceAction, setStatusAction, shareInvoiceAction } from "@/lib/actions/invoices";
import type { InvoiceStatusKey } from "@/lib/status";

const EDITABLE: InvoiceStatusKey[] = ["DRAFT", "SENT", "PENDING", "OVERDUE"];

export function RowActions({ refId, number, status }: { refId: string; number: string; status: InvoiceStatusKey }) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const canPay = status !== "PAID" && status !== "CANCELLED";
  const canShare = status !== "DRAFT" && status !== "CANCELLED";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Actions for invoice ${number}`}>
            <MoreHorizontal className="size-[18px]" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52">
          <DropdownMenuItem asChild><Link href={`/invoices/${refId}`}><Eye aria-hidden />View</Link></DropdownMenuItem>
          {EDITABLE.includes(status) ? <DropdownMenuItem asChild><Link href={`/invoices/${refId}/edit`}><Pencil aria-hidden />Edit</Link></DropdownMenuItem> : null}
          <DropdownMenuItem
            onSelect={async () => {
              const res = await duplicateInvoiceAction(refId);
              if (res.ok) {
                toast.success("Invoice duplicated as a draft");
                router.push(`/invoices/${res.data.ref}/edit`);
              } else toast.error(res.error ?? "Couldn't duplicate the invoice");
            }}
          >
            <Copy aria-hidden />Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem asChild><a href={`/api/invoices/${refId}/pdf`} download><Download aria-hidden />Download PDF</a></DropdownMenuItem>
          <DropdownMenuItem asChild><a href={`/print/${refId}`} target="_blank" rel="noopener"><Printer aria-hidden />Print</a></DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canShare}
            onSelect={async () => {
              const res = await shareInvoiceAction(refId);
              if (!res.ok) return toast.error(res.error ?? "Couldn't create a link");
              try {
                await navigator.clipboard.writeText(res.data.url);
                toast.success("Secure link copied to clipboard");
              } catch {
                toast.message("Share link", { description: res.data.url });
              }
              router.refresh();
            }}
          >
            <Link2 aria-hidden />{canShare ? "Copy share link" : "Share (send it first)"}
          </DropdownMenuItem>
          {canPay ? (
            <DropdownMenuItem
              onSelect={async () => {
                const res = await setStatusAction(refId, "PAID");
                if (res.ok) {
                  toast.success(`Invoice ${number} marked as paid`);
                  router.refresh();
                } else toast.error(res.error ?? "Couldn't update the invoice");
              }}
            >
              <CheckCircle2 aria-hidden />Mark as paid
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setConfirm(true)}><Trash2 aria-hidden />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete invoice ${number}?`}
        description="This permanently removes the invoice and revokes its share link. This can't be undone."
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          const res = await deleteInvoiceAction(refId);
          setBusy(false);
          if (res.ok) {
            setConfirm(false);
            toast.success(`Invoice ${number} deleted`);
            router.refresh();
          } else toast.error(res.error ?? "Couldn't delete the invoice");
        }}
      />
    </>
  );
}
