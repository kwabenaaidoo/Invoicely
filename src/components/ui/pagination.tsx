import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({ page, pages, total, pageSize, params, basePath }: { page: number; pages: number; total: number; pageSize: number; params: Record<string, string | undefined>; basePath: string }) {
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "inline-flex h-9 items-center gap-1 rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-muted";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-4 text-sm">
      <p className="text-muted-foreground" aria-live="polite">{total === 0 ? "No results" : `${from}–${to} of ${total}`}</p>
      <div className="flex items-center gap-2">
        {page > 1 ? <Link href={href(page - 1)} className={btn} rel="prev"><ChevronLeft className="size-4" aria-hidden />Previous</Link> : <span className={cn(btn, "pointer-events-none opacity-50")} aria-disabled="true"><ChevronLeft className="size-4" aria-hidden />Previous</span>}
        <span className="px-1 text-muted-foreground">Page {page} of {pages}</span>
        {page < pages ? <Link href={href(page + 1)} className={btn} rel="next">Next<ChevronRight className="size-4" aria-hidden /></Link> : <span className={cn(btn, "pointer-events-none opacity-50")} aria-disabled="true">Next<ChevronRight className="size-4" aria-hidden /></span>}
      </div>
    </nav>
  );
}
