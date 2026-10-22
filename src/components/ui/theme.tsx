"use client";

import * as React from "react";
import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Toaster as Sonner } from "sonner";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};
/** False during SSR and hydration, true afterwards, without a setState-in-effect. */
function useMounted() {
  return React.useSyncExternalStore(subscribe, () => true, () => false);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Preference is persisted in localStorage by next-themes; the class is applied before paint (no flash).
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="invoicely-theme">
      {children}
    </NextThemes>
  );
}

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={(resolvedTheme as "light" | "dark") ?? "light"}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "!bg-elevated !text-foreground !border !border-border !shadow-card !rounded-lg",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}

/** Always-visible light/dark toggle for the app header. Cycles via explicit buttons for clarity. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn("inline-flex size-10 items-center justify-center rounded-md border border-input bg-card text-foreground transition-colors hover:bg-muted", className)}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {mounted ? isDark ? <Sun className="size-[18px]" aria-hidden /> : <Moon className="size-[18px]" aria-hidden /> : <Monitor className="size-[18px]" aria-hidden />}
    </button>
  );
}

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ] as const;
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
      {options.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors",
              active ? "border-primary bg-accent-soft text-accent-soft-foreground ring-1 ring-primary" : "bg-card hover:bg-muted",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
