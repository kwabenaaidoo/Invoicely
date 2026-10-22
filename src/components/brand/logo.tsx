import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground", className)}>
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M15 3v4h4" />
        <path d="M9.5 13h6M9.5 17h4" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className, collapsed }: { href?: string; className?: string; collapsed?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 rounded-md font-semibold tracking-tight", className)} aria-label="Invoicely home">
      <LogoMark />
      {collapsed ? null : <span className="text-[17px]">Invoicely</span>}
    </Link>
  );
}
