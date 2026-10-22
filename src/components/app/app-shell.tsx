"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { BarChart3, Bell, Code2, FileText, LayoutDashboard, LayoutTemplate, LogOut, Menu, Package, Plus, Search, Settings, Users, X, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn, initials } from "@/lib/utils";
import { logout } from "@/lib/actions/auth";
import { markNotificationsReadAction } from "@/lib/actions/settings";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/products", label: "Products & Services", icon: Package },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/developer", label: "Developer", icon: Code2 },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export type ShellNotification = { id: string; title: string; body: string | null; link: string | null; read: boolean; at: string };

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              active ? "bg-accent-soft text-accent-soft-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {active ? <span aria-hidden className="absolute -left-3 top-2 h-6 w-[3px] rounded-r bg-primary" /> : null}
            <Icon className="size-[18px] shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        router.push(v ? `/invoices?q=${encodeURIComponent(v)}` : "/invoices");
      }}
    >
      <label htmlFor="global-search" className="sr-only">Search invoices</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          id="global-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search invoices, clients…"
          className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground/80 hover:border-muted-foreground/50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>
    </form>
  );
}

function Notifications({ items }: { items: ShellNotification[] }) {
  const router = useRouter();
  const unread = items.filter((n) => !n.read).length;
  return (
    <DropdownMenu
      onOpenChange={async (open) => {
        if (open && unread > 0) {
          await markNotificationsReadAction();
          router.refresh();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex size-10 items-center justify-center rounded-md border border-input bg-card hover:bg-muted"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell className="size-[18px]" aria-hidden />
          {unread > 0 ? <span aria-hidden className="absolute right-2 top-2 size-2 rounded-full bg-primary ring-2 ring-card" /> : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 max-w-[calc(100vw-1.5rem)]">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">You're all caught up.</p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem key={n.id} asChild>
              <Link href={n.link ?? "/dashboard"} className="flex flex-col items-start gap-0.5 !py-2.5">
                <span className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</span>
                {n.body ? <span className="text-xs text-muted-foreground">{n.body}</span> : null}
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ user, notifications, children }: { user: { name: string; email: string }; notifications: ShellNotification[]; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-card px-3 py-4 lg:flex">
        <div className="px-3 pb-5 pt-1"><Logo href="/dashboard" /></div>
        <div className="px-3 pb-4">
          <Button asChild className="w-full"><Link href="/invoices/new"><Plus className="size-4" aria-hidden />New invoice</Link></Button>
        </div>
        <div className="flex-1 overflow-y-auto px-3"><NavLinks /></div>
      </aside>

      {/* Mobile slide-over */}
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col border-r bg-card px-3 py-4 shadow-card focus:outline-none lg:hidden">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Main navigation</DialogPrimitive.Description>
            <div className="flex items-center justify-between px-3 pb-4">
              <Logo href="/dashboard" />
              <DialogPrimitive.Close className="rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Close navigation"><X className="size-5" /></DialogPrimitive.Close>
            </div>
            <div className="px-3 pb-4">
              <Button asChild className="w-full" onClick={() => setOpen(false)}><Link href="/invoices/new"><Plus className="size-4" aria-hidden />New invoice</Link></Button>
            </div>
            <div className="flex-1 overflow-y-auto px-3"><NavLinks onNavigate={() => setOpen(false)} /></div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:gap-3 sm:px-6">
          <button type="button" onClick={() => setOpen(true)} className="inline-flex size-10 items-center justify-center rounded-md border border-input bg-card hover:bg-muted lg:hidden" aria-label="Open navigation">
            <Menu className="size-5" aria-hidden />
          </button>
          <SearchBox className="hidden min-w-0 max-w-md flex-1 sm:block" />
          <div className="ml-auto flex items-center gap-2">
            <Button asChild size="sm" className="sm:hidden"><Link href="/invoices/new"><Plus className="size-4" aria-hidden />New</Link></Button>
            <Notifications items={notifications} />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground" aria-label="Account menu">
                  {initials(user.name) || <UserRound className="size-4" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60">
                <DropdownMenuLabel className="!py-2">
                  <span className="block truncate text-sm font-semibold text-foreground">{user.name}</span>
                  <span className="block truncate text-xs font-normal">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push("/settings")}><Settings aria-hidden />Settings</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push("/developer")}><Code2 aria-hidden />Developer</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void logout()}><LogOut aria-hidden />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className="border-b px-3 py-2 sm:hidden"><SearchBox /></div>
        <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
