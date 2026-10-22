"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { createApiKeyAction, deleteApiKeyAction, regenerateApiKeyAction, revokeApiKeyAction } from "@/lib/actions/developer";
import { formatDate } from "@/lib/utils";
import type { ApiKeyDTO } from "@/lib/services/developer";

function SecretDialog({ secret, publishable, onClose }: { secret: string | null; publishable: string; onClose: () => void }) {
  return (
    <Dialog open={!!secret} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Save your secret key" description="This is the only time the full secret is shown. Store it somewhere safe.">
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-warning"><ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />We only keep a hash of the key, so we can't show it again. If you lose it, regenerate it.</div>
        <div className="mt-4 grid gap-3">
          <div><p className="mb-1 text-xs font-medium text-muted-foreground">Secret key</p><div className="flex items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-md border bg-muted px-3 py-2 font-mono text-xs">{secret}</code>{secret ? <CopyButton value={secret} label="Copy secret key" iconOnly className="size-9 justify-center px-0" /> : null}</div></div>
          <div><p className="mb-1 text-xs font-medium text-muted-foreground">Publishable key</p><div className="flex items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-md border bg-muted px-3 py-2 font-mono text-xs">{publishable}</code><CopyButton value={publishable} label="Copy publishable key" iconOnly className="size-9 justify-center px-0" /></div></div>
        </div>
        <DialogFooter><Button onClick={onClose}>I've saved it</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function KeysManager({ keys }: { keys: ApiKeyDTO[] }) {
  const router = useRouter();
  const [create, setCreate] = React.useState(false);
  const [name, setName] = React.useState("");
  const [mode, setMode] = React.useState<"TEST" | "LIVE">("TEST");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [reveal, setReveal] = React.useState<{ secret: string; pk: string } | null>(null);
  const [confirm, setConfirm] = React.useState<{ kind: "revoke" | "regen" | "delete"; key: ApiKeyDTO } | null>(null);

  const active = keys.filter((k) => !k.revokedAt);
  const revoked = keys.filter((k) => k.revokedAt);

  const row = (k: ApiKeyDTO) => (
    <li key={k.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium">{k.name}<span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${k.mode === "LIVE" ? "bg-accent-soft text-accent-soft-foreground" : "bg-muted text-muted-foreground"}`}>{k.mode === "LIVE" ? "Live" : "Test"}</span>{k.revokedAt ? <span className="rounded bg-destructive-soft px-1.5 py-0.5 text-[11px] font-semibold uppercase text-destructive">Revoked</span> : null}</p>
        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{k.publishable} · sk_…{k.last4}</p>
        <p className="text-xs text-muted-foreground">Created {formatDate(k.createdAt)} · {k.lastUsedAt ? `last used ${formatDate(k.lastUsedAt)}` : "never used"}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {!k.revokedAt ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: "regen", key: k })}><RefreshCw className="size-4" aria-hidden />Regenerate</Button>
            <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: "revoke", key: k })}>Revoke</Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive-soft" onClick={() => setConfirm({ kind: "delete", key: k })}><Trash2 className="size-4" aria-hidden />Remove</Button>
        )}
      </div>
    </li>
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Use <strong>test</strong> keys to try the API in an isolated sandbox. <strong>Live</strong> keys act on your real data.</p>
        <Button onClick={() => { setErr(null); setName(""); setCreate(true); }}><Plus className="size-4" aria-hidden />Create key</Button>
      </div>
      {keys.length === 0 ? (
        <EmptyState icon={<KeyRound />} title="No API keys created" description="Create a test key to start exploring the API." action={<Button onClick={() => setCreate(true)}>Create your first key</Button>} />
      ) : (
        <>
          {active.length ? <ul className="divide-y rounded-lg border bg-card" aria-label="Active API keys">{active.map(row)}</ul> : null}
          {revoked.length ? (<><h3 className="mb-2 mt-6 text-sm font-semibold text-muted-foreground">Revoked</h3><ul className="divide-y rounded-lg border bg-card opacity-80" aria-label="Revoked API keys">{revoked.map(row)}</ul></>) : null}
        </>
      )}

      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent title="Create API key" description="Name it after the app or environment that will use it.">
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy("create"); setErr(null);
              const res = await createApiKeyAction({ name, mode });
              setBusy(null);
              if (!res.ok) return setErr(res.fieldErrors?.name ?? res.error ?? "Couldn't create the key");
              setCreate(false);
              setReveal({ secret: res.data.secret, pk: res.data.key.publishable });
              router.refresh();
            }}
            className="grid gap-4"
          >
            <FormError message={err} />
            <Field label="Key name" required>{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Production backend" autoFocus />}</Field>
            <Field label="Mode" hint={mode === "TEST" ? "Test keys use a separate sandbox. Nothing touches your real invoices and no emails are sent." : "Live keys create real invoices in your account."}>
              {(p) => <Select {...p} value={mode} onChange={(e) => setMode(e.target.value as "TEST" | "LIVE")}><option value="TEST">Test</option><option value="LIVE">Live</option></Select>}
            </Field>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setCreate(false)}>Cancel</Button><Button type="submit" loading={busy === "create"} disabled={!name.trim()}>Create key</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SecretDialog secret={reveal?.secret ?? null} publishable={reveal?.pk ?? ""} onClose={() => setReveal(null)} />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive={confirm?.kind !== "regen"}
        title={confirm?.kind === "revoke" ? `Revoke “${confirm.key.name}”?` : confirm?.kind === "regen" ? `Regenerate “${confirm.key.name}”?` : `Remove “${confirm?.key.name}”?`}
        description={confirm?.kind === "revoke" ? "Requests using this key will fail immediately. This can't be undone." : confirm?.kind === "regen" ? "The current key stops working immediately and a new secret is issued." : "It will be removed from this list for good."}
        confirmLabel={confirm?.kind === "revoke" ? "Revoke key" : confirm?.kind === "regen" ? "Regenerate" : "Remove"}
        loading={busy === "confirm"}
        onConfirm={async () => {
          if (!confirm) return;
          setBusy("confirm");
          if (confirm.kind === "regen") {
            const r = await regenerateApiKeyAction(confirm.key.id);
            setBusy(null);
            if (r.ok) { setConfirm(null); setReveal({ secret: r.data.secret, pk: r.data.key.publishable }); router.refresh(); } else toast.error(r.error ?? "Couldn't regenerate");
            return;
          }
          const r = await (confirm.kind === "revoke" ? revokeApiKeyAction : deleteApiKeyAction)(confirm.key.id);
          setBusy(null);
          if (r.ok) { toast.success(confirm.kind === "revoke" ? "Key revoked" : "Key removed"); setConfirm(null); router.refresh(); } else toast.error(r.error ?? "Something went wrong");
        }}
      />
    </div>
  );
}
