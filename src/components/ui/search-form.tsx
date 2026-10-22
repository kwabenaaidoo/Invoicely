import { Search } from "lucide-react";

/** Plain GET form: works without JavaScript and keeps the query in the URL. */
export function SearchForm({ action, q, placeholder, label }: { action: string; q?: string; placeholder: string; label: string }) {
  return (
    <form action={action} role="search" className="mb-4 max-w-md">
      <label htmlFor="list-q" className="sr-only">{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          id="list-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={placeholder}
          className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground/80 hover:border-muted-foreground/50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>
    </form>
  );
}
