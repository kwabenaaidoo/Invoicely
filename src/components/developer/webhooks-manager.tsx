"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCw, Send, Trash2, Webhook as WebhookIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, FormError, Input } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { createWebhookAction, deleteWebhookAction, retryWebhookEventAction, revealWebhookSecretAction, testWebhookAction, toggleWebhookAction } from "@/lib/actions/developer";
import { WEBHOOK_EVENTS } from "@/lib/validators";
import { formatDate } from "@/lib/utils";
import type { WebhookDTO, WebhookEventDTO } from "@/lib/services/developer";

export function WebhooksManager({ hooks, events }: { hooks: WebhookDTO[]; events: WebhookEventDTO[] }) {
  const router = useRouter();
  const [create, setCreate] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [sel, setSel] = React.useState<string[]>([...WEBHOOK_EVENTS]);
  const [err, setErr] = React.useState<{ form?: string; url?: string; events?: string }>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [del, setDel] = React.useState<WebhookDTO | null>(null);

  const toggleEvent = (e: string) => setSel((s) => (s.includes(e) ? s.filter((x) => x !== e) : [...s, e]));

  return (
    <div className="grid gap-8">
      <section aria-labelledby="eps">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="eps" className="text-base font-semibold tracking-tight">Endpoints</h2>
          <Button onClick={() => { setErr({}); setUrl(""); setDesc(""); setSel([...WEBHOOK_EVENTS]); setCreate(true); }}><Plus className="size-4" aria-hidden />Add endpoint</Button>
        </div>
        {hooks.length === 0 ? (
          <EmptyState icon={<WebhookIcon />} title="No webhook endpoints" description="Get notified at your own URL when invoices are created, sent, paid or go overdue. Requests are signed with a secret." action={<Button onClick={() => setCreate(true)}>Add your first endpoint</Button>} />
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {hooks.map((h) => (
              <li key={h.id} className="flex flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-medium">{h.url}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{h.description ? `${h.description} · ` : ""}{h.events.length} event{h.events.length === 1 ? "" : "s"}: {h.events.join(", ")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="mr-1 flex items-center gap-2 text-sm"><Switch checked={h.enabled} aria-label={`${h.enabled ? "Disable" : "Enable"} endpoint ${h.url}`} onCheckedChange={async (v) => { const r = await toggleWebhookAction(h.id, v); if (r.ok) router.refresh(); else toast.error(r.error ?? "Couldn't update"); }} />{h.enabled ? "Enabled" : "Disabled"}</label>
                  <Button size="sm" variant="outline" loading={busy === `t${h.id}`} onClick={async () => { setBusy(`t${h.id}`); const r = await testWebhookAction(h.id); setBusy(null); if (r.ok) { (r.data.status === "SUCCESS" ? toast.success : toast.error)(r.data.status === "SUCCESS" ? "Test event delivered" : `Delivery failed${r.data.code ? ` (HTTP ${r.data.code})` : ""}`); router.refresh(); } else toast.error(r.error ?? "Couldn't send test"); }}><Send className="size-4" aria-hidden />Send test</Button>
                  <Button size="sm" variant="outline" onClick={async () => { const r = await revealWebhookSecretAction(h.id); if (r.ok) setSecret(r.data.secret); else toast.error(r.error ?? "Couldn't load the secret"); }}>Signing secret</Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive-soft" aria-label={`Delete endpoint ${h.url}`} onClick={() => setDel(h)}><Trash2 className="size-4" aria-hidden /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="evs">
        <h2 id="evs" className="mb-3 text-base font-semibold tracking-tight">Recent events</h2>
        {events.length === 0 ? <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">No events yet. They appear here as invoices change.</p> : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Webhook deliveries</caption>
              <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th scope="col" className="px-4 py-3 font-medium">Event</th><th scope="col" className="px-4 py-3 font-medium">Endpoint</th><th scope="col" className="px-4 py-3 font-medium">Status</th><th scope="col" className="px-4 py-3 font-medium">When</th><th scope="col" className="w-24 px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody className="divide-y">
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 font-mono text-xs">{e.type}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground">{e.endpoint}</td>
                    <td className="px-4 py-3"><span className={`font-medium ${e.status === "SUCCESS" ? "text-success" : e.status === "FAILED" ? "text-destructive" : "text-warning"}`}>{e.status === "SUCCESS" ? "✓ Delivered" : e.status === "FAILED" ? "✕ Failed" : "… Pending"}</span>{e.responseCode ? <span className="ml-1 text-xs text-muted-foreground">HTTP {e.responseCode}</span> : null}{e.error && e.status === "FAILED" ? <div className="max-w-[260px] truncate text-xs text-muted-foreground" title={e.error}>{e.error}</div> : null}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(e.createdAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}</td>
                    <td className="px-4 py-2 text-right">{e.status !== "SUCCESS" ? <Button size="sm" variant="outline" loading={busy === e.id} onClick={async () => { setBusy(e.id); const r = await retryWebhookEventAction(e.id); setBusy(null); if (r.ok) { toast.success("Retry attempted"); router.refresh(); } else toast.error(r.error ?? "Couldn't retry"); }}><RotateCw className="size-4" aria-hidden />Retry</Button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent title="Add webhook endpoint" description="We'll POST signed JSON to this HTTPS URL.">
          <form
            noValidate
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy("create"); setErr({});
              const r = await createWebhookAction({ url, description: desc, events: sel });
              setBusy(null);
              if (!r.ok) return setErr({ form: r.error, url: r.fieldErrors?.url, events: r.fieldErrors?.events });
              setCreate(false); setSecret(r.data.secret); router.refresh();
            }}
          >
            <FormError message={err.form && !err.url && !err.events ? err.form : null} />
            <Field label="Endpoint URL" required error={err.url}>{(p) => <Input {...p} type="url" inputMode="url" placeholder="https://example.com/webhooks/invoicely" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />}</Field>
            <Field label="Description">{(p) => <Input {...p} value={desc} maxLength={120} onChange={(e) => setDesc(e.target.value)} />}</Field>
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium">Events</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {WEBHOOK_EVENTS.map((ev) => <label key={ev} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--ring)]" checked={sel.includes(ev)} onChange={() => toggleEvent(ev)} /><span className="font-mono text-xs">{ev}</span></label>)}
              </div>
              {err.events ? <p role="alert" className="mt-1 text-xs font-medium text-destructive">{err.events}</p> : null}
            </fieldset>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setCreate(false)}>Cancel</Button><Button type="submit" loading={busy === "create"} disabled={!url}>Add endpoint</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!secret} onOpenChange={(o) => !o && setSecret(null)}>
        <DialogContent title="Signing secret" description="Verify the Invoicely-Signature header on every request using this secret.">
          <div className="flex items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-md border bg-muted px-3 py-2 font-mono text-xs">{secret}</code>{secret ? <CopyButton value={secret} label="Copy secret" iconOnly className="size-9 justify-center px-0" /> : null}</div>
          <DialogFooter><Button onClick={() => setSecret(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete this endpoint?" description="Pending deliveries to it are discarded along with its event history." loading={busy === "del"} onConfirm={async () => { if (!del) return; setBusy("del"); const r = await deleteWebhookAction(del.id); setBusy(null); if (r.ok) { toast.success("Endpoint deleted"); setDel(null); router.refresh(); } else toast.error(r.error ?? "Couldn't delete"); }} />
    </div>
  );
}
