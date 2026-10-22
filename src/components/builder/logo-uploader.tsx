"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeImageAction, uploadLogoAction, uploadSignatureAction } from "@/lib/actions/settings";

const MAX = 2 * 1024 * 1024;

/** Client-side checks are for UX only; the server re-validates size and sniffs the real file type. */
export function ImageUploader({ kind, url, label }: { kind: "logos" | "signatures"; url?: string | null; label: string }) {
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX) return toast.error("Image must be 2 MB or smaller.");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return toast.error("Use a PNG, JPEG or WebP image.");
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await (kind === "logos" ? uploadLogoAction(fd) : uploadSignatureAction(fd));
    setBusy(false);
    if (input.current) input.current.value = "";
    if (res.ok) {
      toast.success(`${label} updated`);
      router.refresh();
    } else toast.error(res.error ?? "Upload failed");
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Current ${label.toLowerCase()}`} className="max-h-full max-w-full object-contain" />
        ) : (
          <ImagePlus className="size-5 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" loading={busy} onClick={() => input.current?.click()}>{url ? "Replace" : "Upload"} {label.toLowerCase()}</Button>
          {url ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await removeImageAction(kind);
                setBusy(false);
                router.refresh();
              }}
            >
              <Trash2 className="size-4" aria-hidden />Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPEG or WebP · up to 2 MB</p>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-label={`Choose ${label.toLowerCase()} file`} onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
    </div>
  );
}
