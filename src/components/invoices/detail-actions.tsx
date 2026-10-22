"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Copy, Download, Link2, Pencil, Printer, Send, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { Card } from "@/components/ui/card";
import { deleteInvoiceAction, duplicateInvoiceAction, revokeShareAction, sendInvoiceAction, setStatusAction, shareInvoiceAction } from "@/lib/actions/invoices";
import type { InvoiceStatusKey } from "@/lib/status";

type Props = { refId: string; number: string; status: InvoiceStatusKey; shareUrl: string | null; hasClientEmail: boolean };

export function DetailActions({ refId, number, status, shareUrl, hasClientEmail }: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<"delete" | "cancel" | "revoke" | null>(null);
  const editable = status !== "PAID" && status !== "CANCELLED";

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, after?: () => void) {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (res.ok) {
      toast.success(ok);
      after?.();
      router.refresh();
    } else toast.error(res.error ?? "Something went wrong. Please try again.");
    return res.ok;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {editable ? <Button asChild variant="outline"><Link href={`/invoices/${refId}/edit`}><Pencil className="size-4" aria-hidden />Edit</Link></Button> : null}
        <Button asChild variant="outline"><a href={`/api/invoices/${refId}/pdf`} download><Download className="size-4" aria-hidden />PDF</a></Button>
        <Button asChild variant="outline"><a href={`/print/${refId}`} target="_blank" rel="noopener"><Printer className="size-4" aria-hidden />Print</a></Button>
        {status === "DRAFT" || status === "SENT" || status === "PENDING" || status === "OVERDUE" ? (
          <Button
            variant={status === "DRAFT" ? "primary" : "outline"}
            loading={busy === "send"}
            onClick={() =>
              run(
                "send",
                async () => {
                  const r = await sendInvoiceAction(refId);
                  if (r.ok) toast.message(r.data.emailed ? "Invoice emailed to your client" : "Marked as sent. Share link is ready below.", { description: hasClientEmail && !r.data.emailed ? "Email delivery isn't configured on this server, so copy the link to send it yourself." : undefined });
                  return r;
                },
                status === "DRAFT" ? "Invoice sent" : "Invoice re-sent",
              )
            }
          >
            <Send className="size-4" aria-hidden />{status === "DRAFT" ? "Send" : "Re-send"}
          </Button>
        ) : null}
        {editable ? (
          <Button variant={status === "DRAFT" ? "outline" : "primary"} loading={busy === "paid"} onClick={() => run("paid", () => setStatusAction(refId, "PAID"), `Invoice ${number} marked as paid`)}>
            <CheckCircle2 className="size-4" aria-hidden />Mark as paid
          </Button>
        ) : null}
        {status === "PAID" ? (
          <Button variant="outline" loading={busy === "unpay"} onClick={() => run("unpay", () => setStatusAction(refId, "SENT"), "Invoice reopened")}><Undo2 className="size-4" aria-hidden />Mark unpaid</Button>
        ) : null}
        <Button
          variant="ghost"
          loading={busy === "dup"}
          onClick={async () => {
            setBusy("dup");
            const res = await duplicateInvoiceAction(refId);
            setBusy(null);
            if (res.ok) {
              toast.success("Duplicated as a new draft");
              router.push(`/invoices/${res.data.ref}/edit`);
            } else toast.error(res.error ?? "Couldn't duplicate");
          }}
        >
          <Copy className="size-4" aria-hidden />Duplicate
        </Button>
        {editable && status !== "DRAFT" ? <Button variant="ghost" onClick={() => setConfirm("cancel")}><Ban className="size-4" aria-hidden />Cancel invoice</Button> : null}
        <Button variant="ghost" className="text-destructive hover:bg-destructive-soft" onClick={() => setConfirm("delete")}><Trash2 className="size-4" aria-hidden />Delete</Button>
      </div>

      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete invoice ${number}?`}
        description="This permanently removes the invoice and revokes its share link. This can't be undone."
        loading={busy === "delete"}
        onConfirm={async () => {
          const ok = await run("delete", () => deleteInvoiceAction(refId), "Invoice deleted");
          if (ok) router.push("/invoices");
        }}
      />
      <ConfirmDialog
        open={confirm === "cancel"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Cancel invoice ${number}?`}
        description="The invoice is kept for your records, marked as cancelled, and its share link stops working."
        confirmLabel="Cancel invoice"
        loading={busy === "cancel"}
        onConfirm={async () => {
          await run("cancel", () => setStatusAction(refId, "CANCELLED"), "Invoice cancelled", () => setConfirm(null));
        }}
      />
      <ConfirmDialog
        open={confirm === "revoke"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Revoke share link?"
        description="Anyone with the current link will lose access immediately. You can create a new link later."
        confirmLabel="Revoke link"
        loading={busy === "revoke"}
        onConfirm={async () => {
          await run("revoke", () => revokeShareAction(refId), "Share link revoked", () => setConfirm(null));
        }}
      />

      <Card className="p-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Link2 className="size-4" aria-hidden />Secure share link</h2>
        {shareUrl ? (
          <>
            <p className="mt-1 text-[13px] text-muted-foreground">Anyone with this link can view and download the invoice. Revoke it any time.</p>
            <div className="mt-3 flex items-center gap-2">
              <label htmlFor="share-url" className="sr-only">Share URL</label>
              <input id="share-url" readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-muted px-2.5 font-mono text-xs" />
              <CopyButton value={shareUrl} iconOnly label="Copy share link" className="size-9 justify-center px-0" />
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setConfirm("revoke")}>Revoke link</Button>
          </>
        ) : (
          <>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {status === "DRAFT" ? "Drafts can't be shared. Send the invoice first." : status === "CANCELLED" ? "Cancelled invoices can't be shared." : "Create an unguessable public link to send to your client."}
            </p>
            <Button
              size="sm"
              className="mt-3"
              disabled={status === "DRAFT" || status === "CANCELLED"}
              loading={busy === "share"}
              onClick={() => run("share", () => shareInvoiceAction(refId), "Share link created")}
            >
              Create share link
            </Button>
          </>
        )}
      </Card>
    </>
  );
}
