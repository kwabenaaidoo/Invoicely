"use client";

import * as React from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

const LANGS = [
  { id: "curl", label: "cURL" },
  { id: "js", label: "JavaScript" },
  { id: "ts", label: "TypeScript" },
  { id: "py", label: "Python" },
  { id: "php", label: "PHP" },
] as const;
type Lang = (typeof LANGS)[number]["id"];

type Call = { method: "GET" | "POST" | "PATCH" | "DELETE"; path: string; body?: unknown; binary?: boolean };

const pretty = (o: unknown, indent = 2) => JSON.stringify(o, null, indent);

function snippet(lang: Lang, base: string, c: Call): string {
  const url = `${base}${c.path}`;
  const hasBody = c.body !== undefined;
  const json = hasBody ? pretty(c.body) : "";
  switch (lang) {
    case "curl":
      return [`curl ${c.method === "GET" ? "" : `-X ${c.method} `}${url}${c.binary ? " --output invoice.pdf" : ""} \\`, `  -H "Authorization: Bearer $INVOICELY_SECRET_KEY"${hasBody ? " \\" : ""}`, ...(hasBody ? [`  -H "Content-Type: application/json" \\`, `  -d '${JSON.stringify(c.body)}'`] : [])].join("\n");
    case "js":
      return `const res = await fetch("${url}", {\n  method: "${c.method}",\n  headers: {\n    Authorization: \`Bearer \${process.env.INVOICELY_SECRET_KEY}\`,${hasBody ? '\n    "Content-Type": "application/json",' : ""}\n  },${hasBody ? `\n  body: JSON.stringify(${json.replace(/\n/g, "\n  ")}),` : ""}\n});\n${c.binary ? "const pdf = Buffer.from(await res.arrayBuffer());" : "const { success, data, error } = await res.json();"}`;
    case "ts":
      return `const res = await fetch("${url}", {\n  method: "${c.method}",\n  headers: {\n    Authorization: \`Bearer \${process.env.INVOICELY_SECRET_KEY!}\`,${hasBody ? '\n    "Content-Type": "application/json",' : ""}\n  },${hasBody ? `\n  body: JSON.stringify(${json.replace(/\n/g, "\n  ")}),` : ""}\n});\n${c.binary ? "const pdf: Buffer = Buffer.from(await res.arrayBuffer());" : "type Result<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };\nconst result = (await res.json()) as Result<{ id: string; invoiceNumber: string; status: string }>;\nif (!result.success) throw new Error(result.error.message);"}`;
    case "py": {
      const py = json.replace(/true/g, "True").replace(/false/g, "False").replace(/null/g, "None").replace(/\n/g, "\n    ");
      return `import os, requests\n\nres = requests.${c.method.toLowerCase()}(\n    "${url}",\n    headers={"Authorization": f"Bearer {os.environ['INVOICELY_SECRET_KEY']}"},${hasBody ? `\n    json=${py},` : ""}\n)\n${c.binary ? 'open("invoice.pdf", "wb").write(res.content)' : "print(res.json())"}`;
    }
    case "php": {
      const toPhp = (v: unknown, d = 1): string => {
        const pad = "    ".repeat(d);
        if (Array.isArray(v)) return `[\n${v.map((x) => `${pad}${toPhp(x, d + 1)},`).join("\n")}\n${"    ".repeat(d - 1)}]`;
        if (v && typeof v === "object") return `[\n${Object.entries(v).map(([k, x]) => `${pad}'${k}' => ${toPhp(x, d + 1)},`).join("\n")}\n${"    ".repeat(d - 1)}]`;
        return typeof v === "string" ? `'${v}'` : String(v);
      };
      return `<?php\n$ch = curl_init("${url}");\ncurl_setopt_array($ch, [\n    CURLOPT_CUSTOMREQUEST => "${c.method}",\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_HTTPHEADER => [\n        "Authorization: Bearer " . getenv("INVOICELY_SECRET_KEY"),${hasBody ? '\n        "Content-Type: application/json",' : ""}\n    ],${hasBody ? `\n    CURLOPT_POSTFIELDS => json_encode(${toPhp(c.body)}),` : ""}\n]);\n$response = curl_exec($ch);\n${c.binary ? 'file_put_contents("invoice.pdf", $response);' : "$result = json_decode($response, true);"}`;
    }
  }
}

function Code({ code, label }: { code: string; label: string }) {
  return (
    <div className="relative rounded-lg border bg-muted">
      <div className="absolute right-2 top-2"><CopyButton value={code} label={`Copy ${label}`} /></div>
      <pre className="overflow-x-auto p-4 pr-24 font-mono text-[12.5px] leading-relaxed" tabIndex={0}><code>{code}</code></pre>
    </div>
  );
}

function Verb({ m }: { m: string }) {
  const c: Record<string, string> = { GET: "bg-info-soft text-info", POST: "bg-success-soft text-success", PATCH: "bg-warning-soft text-warning", DELETE: "bg-destructive-soft text-destructive" };
  return <span className={cn("rounded px-1.5 py-0.5 font-mono text-[11px] font-bold", c[m])}>{m}</span>;
}

const INVOICE_BODY = {
  client: { name: "Ada Mensah", company: "Globex Ltd", email: "ada@globex.com" },
  currency: "USD",
  paymentTerms: 14,
  items: [
    { description: "Website design", quantity: 1, unitPrice: 1200, taxRate: 10 },
    { description: "Hosting (3 months)", quantity: 3, unitPrice: 49 },
  ],
  status: "sent",
};
const INVOICE_RESPONSE = {
  success: true,
  livemode: true,
  data: { id: "inv_3f9c…", invoiceNumber: "INV-0001", status: "sent", currency: "USD", total: "1467.00", dueDate: "2026-11-03", publicUrl: "https://…/invoice/public/…" },
};

const SECTIONS: { id: string; title: string; body: React.ReactNode; call?: Call; response?: unknown }[] = [
  {
    id: "authentication",
    title: "Authentication",
    body: (
      <>
        <p>Authenticate every request with your <strong>secret key</strong> in the <code>Authorization</code> header. Keep it on your server; never ship it in a browser or mobile app.</p>
        <p>Keys come in two modes. <code>sk_test_…</code> keys act on an isolated sandbox (no emails, no effect on real data). <code>sk_live_…</code> keys act on your real account.</p>
      </>
    ),
  },
  { id: "quick-start", title: "Quick start", body: <p>Create a test key in <em>Developer → API Keys</em>, then create your first invoice. The response includes a ready-to-share <code>publicUrl</code> once the invoice is sent.</p>, call: { method: "POST", path: "/api/v1/invoices", body: INVOICE_BODY }, response: INVOICE_RESPONSE },
  { id: "create-invoice", title: "Create invoice", body: <p>Provide <code>items</code> and either an existing <code>clientId</code> (<code>cli_…</code>) or an inline <code>client</code>. Currency, dates, tax and design default from your business settings. Totals are calculated server-side.</p>, call: { method: "POST", path: "/api/v1/invoices", body: INVOICE_BODY }, response: INVOICE_RESPONSE },
  { id: "get-invoice", title: "Get invoice", body: <p>Retrieve an invoice by its <code>inv_…</code> id. <code>GET /api/v1/invoices</code> lists invoices with <code>page</code>, <code>pageSize</code> (max 100), <code>status</code>, <code>clientId</code> and <code>q</code>.</p>, call: { method: "GET", path: "/api/v1/invoices/inv_3f9c…" }, response: INVOICE_RESPONSE },
  { id: "update-invoice", title: "Update invoice", body: <p>Send only the fields to change. Pass <code>status</code> (<code>draft</code>, <code>sent</code>, <code>paid</code>, <code>cancelled</code>…) to transition. Paid and cancelled invoices can't be edited. <code>POST /invoices/:id/send</code> sends the invoice and creates the share link.</p>, call: { method: "PATCH", path: "/api/v1/invoices/inv_3f9c…", body: { status: "paid" } }, response: { success: true, data: { id: "inv_3f9c…", status: "paid" } } },
  { id: "delete-invoice", title: "Delete invoice", body: <p>Permanently deletes an invoice. Paid invoices can't be deleted; cancel them instead.</p>, call: { method: "DELETE", path: "/api/v1/invoices/inv_3f9c…" }, response: { success: true, data: { id: "inv_3f9c…", deleted: true } } },
  { id: "generate-pdf", title: "Generate PDF", body: <p>Returns the invoice as <code>application/pdf</code>, rendered with the exact design you see in the app. Limited to 20 requests per minute per key.</p>, call: { method: "POST", path: "/api/v1/invoices/inv_3f9c…/pdf", binary: true } },
  { id: "clients", title: "Clients", body: <p><code>GET /api/v1/clients</code> lists clients (paginated, <code>q</code> searches). <code>POST</code> creates one.</p>, call: { method: "POST", path: "/api/v1/clients", body: { name: "Ada Mensah", company: "Globex Ltd", email: "ada@globex.com", country: "Ghana" } }, response: { success: true, data: { id: "cli_8a1b…", name: "Ada Mensah" } } },
  { id: "products", title: "Products", body: <p><code>GET /api/v1/products</code> lists your catalogue. <code>POST</code> creates a product or service.</p>, call: { method: "POST", path: "/api/v1/products", body: { name: "Consulting hour", sku: "CONS-1", unitPrice: 120, taxRate: 0, currency: "USD" } }, response: { success: true, data: { id: "prod_77ce…", name: "Consulting hour", unitPrice: 120 } } },
];

const ERRORS = [
  ["400 / 422", "VALIDATION_ERROR", "The body failed validation. See error.details for each field."],
  ["401", "UNAUTHORIZED", "Missing, malformed or revoked API key."],
  ["403", "FORBIDDEN", "The key can't access this resource."],
  ["404", "NOT_FOUND", "The resource doesn't exist in your account."],
  ["409", "CONFLICT", "The action conflicts with current state, e.g. editing a paid invoice or a duplicate invoice number."],
  ["429", "RATE_LIMITED", "Too many requests. Honour the Retry-After header."],
  ["500", "INTERNAL", "Something went wrong on our side."],
];

const WEBHOOK_VERIFY = `import { createHmac, timingSafeEqual } from "node:crypto";

// header: Invoicely-Signature: t=1700000000,v1=<hex hmac>
export function verify(rawBody: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false; // reject stale
  const expected = createHmac("sha256", secret).update(\`\${parts.t}.\${rawBody}\`).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}`;

export function ApiDocs({ baseUrl }: { baseUrl: string }) {
  const [lang, setLang] = React.useState<Lang>("curl");
  return (
    <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Documentation sections" className="hidden lg:block">
        <ul className="sticky top-24 flex flex-col gap-0.5 text-sm">
          {[...SECTIONS.map((s) => [s.id, s.title]), ["webhooks", "Webhooks"], ["errors", "Errors"], ["rate-limits", "Rate limits"]].map(([id, t]) => (
            <li key={id}><a href={`#${id}`} className="block rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">{t}</a></li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0">
        <div className="sticky top-16 z-10 -mx-4 mb-6 border-b bg-background/90 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-2">
          <div role="tablist" aria-label="Code language" className="flex gap-1 overflow-x-auto">
            {LANGS.map((l) => (
              <button key={l.id} role="tab" type="button" aria-selected={lang === l.id} onClick={() => setLang(l.id)} className={cn("h-8 shrink-0 rounded-md px-3 text-sm font-medium", lang === l.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{l.label}</button>
            ))}
          </div>
        </div>

        <div className="mb-8 rounded-lg border bg-card p-4 text-sm">Base URL <code className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{baseUrl}/api/v1</code>. All responses are JSON: <code>{`{ "success": true, "data": … }`}</code> or <code>{`{ "success": false, "error": { "code", "message" } }`}</code>.</div>

        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-32 border-b py-8 first:pt-0">
            <h2 className="text-xl font-semibold tracking-tight">{s.title}</h2>
            <div className="mt-2 grid max-w-3xl gap-2 text-sm leading-relaxed text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_code]:text-foreground [&_strong]:text-foreground">{s.body}</div>
            {s.call ? (
              <div className="mt-4 grid gap-3">
                <p className="flex items-center gap-2 font-mono text-sm"><Verb m={s.call.method} />{s.call.path}</p>
                <Code code={snippet(lang, baseUrl, s.call)} label={`${s.title} example`} />
                {s.response ? <><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Response</p><Code code={pretty(s.response)} label="response" /></> : null}
              </div>
            ) : null}
          </section>
        ))}

        <section id="webhooks" className="scroll-mt-32 border-b py-8">
          <h2 className="text-xl font-semibold tracking-tight">Webhooks</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">Subscribe to <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">invoice.created</code>, <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">invoice.updated</code>, <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">invoice.sent</code>, <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">invoice.paid</code>, <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">invoice.overdue</code> and <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">invoice.cancelled</code>. Endpoints must be public HTTPS URLs. Each request is signed with your endpoint secret in the <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">Invoicely-Signature</code> header. Failed deliveries can be retried from the Webhooks tab.</p>
          <div className="mt-4"><Code code={WEBHOOK_VERIFY} label="signature verification" /></div>
        </section>

        <section id="errors" className="scroll-mt-32 border-b py-8">
          <h2 className="text-xl font-semibold tracking-tight">Errors</h2>
          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[480px] text-sm">
              <caption className="sr-only">API error codes</caption>
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th scope="col" className="px-4 py-2.5 font-medium">HTTP</th><th scope="col" className="px-4 py-2.5 font-medium">Code</th><th scope="col" className="px-4 py-2.5 font-medium">Meaning</th></tr></thead>
              <tbody className="divide-y">{ERRORS.map(([h, c, m]) => <tr key={c}><td className="px-4 py-2.5 font-mono text-xs">{h}</td><td className="px-4 py-2.5 font-mono text-xs font-semibold">{c}</td><td className="px-4 py-2.5 text-muted-foreground">{m}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-4"><Code code={pretty({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid invoice data", details: [{ path: "items.0.quantity", message: "Quantity must be greater than 0" }] } })} label="error response" /></div>
        </section>

        <section id="rate-limits" className="scroll-mt-32 py-8">
          <h2 className="text-xl font-semibold tracking-tight">Rate limits</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">Live keys: 120 requests per minute. Test keys: 60 per minute. PDF generation: 20 per minute per key. Every response includes <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">X-RateLimit-Limit</code>, <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">X-RateLimit-Remaining</code> and <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">X-RateLimit-Reset</code>. When exceeded you get a <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">429</code> with <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">Retry-After</code>.</p>
        </section>
      </div>
    </div>
  );
}
