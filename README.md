# Invoicely

Invoice generation and management SaaS: live-preview builder, templates, client CRM, product catalog, PDF export, secure share links, and a developer platform (API keys, versioned REST API, signed webhooks).

**Stack:** Next.js 16 (App Router), React, TypeScript, Tailwind v4, Lucide, PostgreSQL + Prisma 7, Zod + React Hook Form, Puppeteer (PDF), S3-compatible or local storage. dop jfj

## Setup

```bash
npm install
cp .env.example .env        # then edit values
npx prisma migrate deploy   # or: npx prisma migrate dev
npx prisma generate
npm run dev
```

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_URL` | Public base URL (share links, emails) |
| `ENCRYPTION_KEY` | 32-byte key (hex/base64) encrypting webhook secrets. Required in production |
| `CHROMIUM_PATH` | Chromium/Chrome binary used for server-side PDFs |
| `RESEND_API_KEY` | Optional. Without it, emails are logged to the console |
| `STORAGE_*` / `S3_*` | Optional. Without them, uploads go to local disk; see `.env.example` |

## Scripts

- `npm run dev` / `npm run build` / `npm start`
- `npx vitest run`: unit and integration tests (needs `DATABASE_URL`)
- `npx tsc --noEmit`, `npm run lint`

## Architecture notes

- Auth: opaque server-side sessions (hashed cookie token), bcrypt, DB-backed rate limiting. `src/proxy.ts` is an optimistic redirect only; real authorization is in `src/lib/auth/dal.ts`, and every query is scoped by business.
- Money is integer minor units; `calculateInvoice` is the single source of truth. The same `InvoiceDocument` component renders the live preview, the public page and the PDF.
- Public ids (`inv_`, `cli_`, `prod_`, `whk_`) are exposed; internal UUIDs never leave the server.

## REST API (`/api/v1`)

Auth: `Authorization: Bearer sk_test_…` or `sk_live_…` (create under Developer → API keys; shown once, stored hashed). Test keys operate on an isolated sandbox business. Rate limits: 120/min live, 60/min test, with `X-RateLimit-*` headers.

- `GET/POST /invoices`, `GET/PATCH/DELETE /invoices/{id}`, `POST /invoices/{id}/send`, `GET /invoices/{id}/pdf`
- `GET/POST /clients`, `GET/POST /products`

Responses: `{ "success": true, "data": … }` or `{ "success": false, "error": { "code", "message" } }`. Interactive docs with cURL/JS/TS/Python/PHP samples are in the app at Developer → Docs. Webhooks are HMAC-signed with retries.

## Known caveats

- Prisma `migrate`/`generate` could not run in the build sandbox (engine download blocked); the schema SQL was applied directly. Run them normally in your environment.
- `/privacy`, `/terms`, `/contact` are placeholders.
- Phase 3 features (subscriptions, teams, multi-business, recurring invoices) are architecture-ready only.
