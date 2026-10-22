"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CopyButton({ value, label = "Copy", className, iconOnly }: { value: string; label?: string; className?: string; iconOnly?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Copied to clipboard");
          setTimeout(() => setCopied(false), 1800);
        } catch {
          toast.error("Couldn't copy. Select the text and copy it manually.");
        }
      }}
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-xs font-medium hover:bg-muted", className)}
      aria-label={iconOnly ? label : undefined}
    >
      {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {iconOnly ? null : <span aria-live="polite">{copied ? "Copied" : label}</span>}
    </button>
  );
}
