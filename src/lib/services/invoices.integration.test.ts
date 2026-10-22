import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (fn: () => void) => void fn() }));

process.env.DATABASE_URL ??= "postgresql://postgres@127.0.0.1:54329/invoicely";
vi.stubEnv("NODE_ENV", "test");

const hasDb = !!process.env.DATABASE_URL && process.env.SKIP_DB_TESTS !== "1";

describe.skipIf(!hasDb)("invoice services (real database)", () => {
  let db: typeof import("../db").db;
  let svc: typeof import("./invoices");
  let rate: typeof import("../rate-limit");
  let schema: typeof import("../validators");
  const created: string[] = [];

  async function makeTenant(label: string) {
    const user = await db.user.create({ data: { email: `${label}-${Date.now()}-${Math.random()}@example.com`, name: label } });
    created.push(user.id);
    const business = await db.business.create({ data: { ownerId: user.id, name: `${label} Co` } });
    return { user, business, ctx: { businessId: business.id, userId: user.id } };
  }

  const baseInput = (over: Record<string, unknown> = {}) =>
    schema.invoiceSchema.parse({
      issueDate: "2026-10-01",
      dueDate: "2026-10-15",
      paymentTerms: 14,
      currency: "USD",
      discountType: "PERCENT",
      discountValue: 10,
      shipping: 5,
      business: { name: "Acme Studio" },
      client: { name: "Globex Ltd", email: "billing@globex.test" },
      design: {},
      saveClient: true,
      items: [
        { description: "Design work", quantity: 10, unitPrice: 85, taxRate: 10, discountRate: 0 },
        { description: "Hosting", quantity: 1, unitPrice: 49.99, taxRate: 0, discountRate: 0 },
      ],
      ...over,
    });

  beforeAll(async () => {
    ({ db } = await import("../db"));
    svc = await import("./invoices");
    rate = await import("../rate-limit");
    schema = await import("../validators");
  });

  afterAll(async () => {
    if (!db) return;
    await db.user.deleteMany({ where: { id: { in: created } } });
    await db.$disconnect();
  });

  it("creates an invoice with auto numbering and exact stored totals", async () => {
    const { ctx } = await makeTenant("alpha");
    const a = await svc.createInvoice(ctx, baseInput());
    const b = await svc.createInvoice(ctx, baseInput());
    expect(a.number).toBe("INV-0001");
    expect(b.number).toBe("INV-0002");
    // subtotal 850 + 49.99 = 899.99; 10% off = 89.999 -> 90.00 ; tax on discounted base
    expect(a.subtotal.toString()).toBe("899.99");
    expect(a.discountTotal.toString()).toBe("90");
    expect(a.shipping.toString()).toBe("5");
    const expectedTotal = Number(a.subtotal) - Number(a.discountTotal) + Number(a.taxTotal) + Number(a.shipping);
    expect(Number(a.total)).toBeCloseTo(expectedTotal, 2);
    const withClient = await svc.getInvoiceByPublicId(ctx.businessId, a.publicId);
    expect(withClient?.client?.name).toBe("Globex Ltd");
    expect(withClient?.items).toHaveLength(2);
  });

  it("rejects duplicate custom numbers and past due dates", async () => {
    const { ctx } = await makeTenant("bravo");
    await svc.createInvoice(ctx, baseInput({ number: "CUSTOM-1" }));
    await expect(svc.createInvoice(ctx, baseInput({ number: "CUSTOM-1" }))).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(svc.createInvoice(ctx, baseInput({ dueDate: "2026-09-01" }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("isolates tenants: another business can't read, edit, delete, share or change status", async () => {
    const a = await makeTenant("tenant-a");
    const b = await makeTenant("tenant-b");
    const inv = await svc.createInvoice(a.ctx, baseInput());
    const ref = `inv_${inv.publicId}`;

    expect(await svc.getInvoiceByPublicId(b.ctx.businessId, ref)).toBeNull();
    await expect(svc.updateInvoice(b.ctx, ref, baseInput())).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(svc.deleteInvoice(b.ctx, ref)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(svc.changeStatus(b.ctx, ref, "PAID")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(svc.enableSharing(b.ctx, ref)).rejects.toMatchObject({ code: "NOT_FOUND" });
    // and can't attach A's client to B's invoice
    const aClient = await db.client.findFirstOrThrow({ where: { businessId: a.ctx.businessId } });
    await expect(svc.createInvoice(b.ctx, baseInput({ clientId: aClient.id, saveClient: false }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    // owner is unaffected
    expect((await svc.getInvoiceByPublicId(a.ctx.businessId, ref))?.status).toBe("DRAFT");
  });

  it("handles status transitions, payments and sharing rules", async () => {
    const { ctx } = await makeTenant("charlie");
    const inv = await svc.createInvoice(ctx, baseInput({ dueDate: "2099-01-01" }));
    const ref = `inv_${inv.publicId}`;

    await expect(svc.enableSharing(ctx, ref)).rejects.toMatchObject({ code: "CONFLICT" }); // drafts can't be shared

    await svc.changeStatus(ctx, ref, "SENT");
    const shared = await svc.enableSharing(ctx, ref);
    expect(shared.publicToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const paid = await svc.changeStatus(ctx, ref, "PAID");
    expect(paid.amountPaid.toString()).toBe(paid.total.toString());
    expect(paid.paidAt).not.toBeNull();
    expect(await db.invoicePayment.count({ where: { invoiceId: inv.id } })).toBe(1);

    await expect(svc.updateInvoice(ctx, ref, baseInput())).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(svc.deleteInvoice(ctx, ref)).rejects.toMatchObject({ code: "CONFLICT" });

    const revoked = await svc.revokeSharing(ctx, ref);
    expect(revoked.publicToken).toBeNull();
    expect(await db.invoice.findUnique({ where: { publicToken: shared.publicToken! } })).toBeNull();

    const back = await svc.changeStatus(ctx, ref, "SENT");
    expect(back.amountPaid.toString()).toBe("0");
    expect(await db.invoicePayment.count({ where: { invoiceId: inv.id } })).toBe(0);
  });

  it("duplicates as a draft with a fresh number and no public link", async () => {
    const { ctx } = await makeTenant("delta");
    const inv = await svc.createInvoice(ctx, baseInput({ dueDate: "2099-01-01" }));
    await svc.changeStatus(ctx, `inv_${inv.publicId}`, "SENT");
    await svc.enableSharing(ctx, `inv_${inv.publicId}`);
    const copy = await svc.duplicateInvoice(ctx, `inv_${inv.publicId}`);
    expect(copy.status).toBe("DRAFT");
    expect(copy.number).not.toBe(inv.number);
    expect(copy.publicToken).toBeNull();
    expect(copy.total.toString()).toBe(inv.total.toString());
  });

  it("flips past-due unpaid invoices to overdue", async () => {
    const { ctx } = await makeTenant("echo");
    const inv = await svc.createInvoice(ctx, baseInput({ issueDate: "2020-01-01", dueDate: "2020-01-15" }));
    await svc.changeStatus(ctx, `inv_${inv.publicId}`, "SENT");
    const n = await svc.syncOverdue(ctx.businessId);
    expect(n).toBe(1);
    expect((await svc.getInvoiceByPublicId(ctx.businessId, inv.publicId))?.status).toBe("OVERDUE");
    expect(await db.notification.count({ where: { userId: ctx.userId! } })).toBeGreaterThan(0);
  });

  it("filters, searches and paginates", async () => {
    const { ctx } = await makeTenant("foxtrot");
    for (let i = 0; i < 5; i++) await svc.createInvoice(ctx, baseInput({ reference: i === 2 ? "SPECIAL-REF" : undefined, saveClient: i === 0 }));
    const all = await svc.listInvoices(ctx.businessId, { pageSize: 2 });
    expect(all.total).toBe(5);
    expect(all.pages).toBe(3);
    expect(all.rows).toHaveLength(2);
    const hit = await svc.listInvoices(ctx.businessId, { q: "special-ref" });
    expect(hit.total).toBe(1);
    expect((await svc.listInvoices(ctx.businessId, { status: "PAID" })).total).toBe(0);
  });

  it("rate limiter counts atomically per window", async () => {
    const key = `test:${Math.random()}`;
    const results = await Promise.all(Array.from({ length: 6 }, () => rate.rateLimit(key, 4, 60)));
    expect(results.filter((r) => r.allowed)).toHaveLength(4);
    expect(results.filter((r) => !r.allowed)).toHaveLength(2);
  });
});
