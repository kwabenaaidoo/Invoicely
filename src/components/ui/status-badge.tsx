import { Ban, CircleAlert, CircleCheck, Clock, FilePen, Send, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_META, type InvoiceStatusKey } from "@/lib/status";

const ICONS: Record<string, LucideIcon> = { FilePen, Send, Clock, CircleCheck, CircleAlert, Ban };

const TONES = {
  neutral: "bg-muted text-foreground border-input",
  info: "bg-info-soft text-info border-info/30",
  warning: "bg-warning-soft text-warning border-warning/30",
  success: "bg-success-soft text-success border-success/30",
  danger: "bg-destructive-soft text-destructive border-destructive/30",
  muted: "bg-muted text-muted-foreground border-input line-through decoration-muted-foreground/60",
} as const;

/** Status is always icon + text + colour, so it never relies on colour alone. */
export function StatusBadge({ status, className }: { status: InvoiceStatusKey; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = ICONS[meta.icon]!;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium", TONES[meta.tone], className)}>
      <Icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}
