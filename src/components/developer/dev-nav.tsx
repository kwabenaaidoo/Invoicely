"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/developer", label: "Overview" },
  { href: "/developer/keys", label: "API Keys" },
  { href: "/developer/docs", label: "Documentation" },
  { href: "/developer/usage", label: "API Usage" },
  { href: "/developer/webhooks", label: "Webhooks" },
];

export function DevNav() {
  const path = usePathname();
  return (
    <nav aria-label="Developer" className="-mx-4 mb-6 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {ITEMS.map((i) => {
          const active = i.href === "/developer" ? path === i.href : path.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={active ? "page" : undefined} className={cn("inline-flex h-11 items-center border-b-2 px-3 text-sm font-medium transition-colors", active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
