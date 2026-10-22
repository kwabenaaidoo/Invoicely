import { roundDiv, toMinor } from "./money";

export type CalcItemInput = {
  quantity: number | string;
  unitPrice: number | string;
  /** percent, 0–100 */
  taxRate?: number | string;
  /** percent, 0–100 */
  discountRate?: number | string;
};

export type CalcInput = {
  currency: string;
  items: CalcItemInput[];
  discountType?: "PERCENT" | "FIXED";
  discountValue?: number | string;
  shipping?: number | string;
};

export type CalcLine = {
  gross: number;
  lineDiscount: number;
  /** net of line discount, before invoice discount and tax */
  net: number;
  invoiceDiscountShare: number;
  taxable: number;
  tax: number;
};

export type CalcResult = {
  lines: CalcLine[];
  /** sum of quantity × unit price */
  subtotal: number;
  lineDiscountTotal: number;
  invoiceDiscount: number;
  discountTotal: number;
  taxTotal: number;
  shipping: number;
  total: number;
  issues: string[];
};

const bp = (pct: number | string | undefined) => {
  const n = typeof pct === "string" ? Number(pct) : pct ?? 0;
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(100, Math.max(0, n)) * 100);
};

/** Spread `amount` across weights so the parts add up exactly (largest remainder). */
function allocate(amount: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (amount <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (amount * w) / total);
  const floors = raw.map(Math.floor);
  let remainder = amount - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    if (weights[i]! > 0) {
      floors[i]! += 1;
      remainder -= 1;
    }
  }
  return floors;
}

/**
 * Single source of truth for invoice maths, used by the builder preview, the
 * server actions, the REST API and the PDF renderer.
 *
 * Order of operations:
 *  1. gross = qty × unit price
 *  2. line discount (percent) → net
 *  3. invoice-level discount (percent or fixed) is allocated proportionally across lines
 *  4. tax is charged per line on the discounted amount
 *  5. shipping is added last and is not taxed
 */
export function calculateInvoice(input: CalcInput): CalcResult {
  const issues: string[] = [];
  const currency = input.currency;

  const base = input.items.map((item) => {
    const qtyMilli = Math.max(0, Math.round(Number(item.quantity) * 1000)) || 0;
    const unit = Math.max(0, toMinor(item.unitPrice, currency) ?? 0);
    const gross = roundDiv(qtyMilli * unit, 1000);
    const lineDiscount = roundDiv(gross * bp(item.discountRate), 10000);
    return { gross, lineDiscount, net: gross - lineDiscount, taxBp: bp(item.taxRate) };
  });

  const subtotal = base.reduce((a, l) => a + l.gross, 0);
  const lineDiscountTotal = base.reduce((a, l) => a + l.lineDiscount, 0);
  const netSum = base.reduce((a, l) => a + l.net, 0);

  let invoiceDiscount = 0;
  const dv = input.discountValue ?? 0;
  if (input.discountType === "FIXED") {
    const fixed = Math.max(0, toMinor(dv, currency) ?? 0);
    invoiceDiscount = Math.min(fixed, netSum);
    if (fixed > netSum) issues.push("Discount is larger than the invoice subtotal and was capped.");
  } else {
    invoiceDiscount = roundDiv(netSum * bp(dv), 10000);
  }

  const shares = allocate(invoiceDiscount, base.map((l) => l.net));
  const lines: CalcLine[] = base.map((l, i) => {
    const share = shares[i]!;
    const taxable = l.net - share;
    return {
      gross: l.gross,
      lineDiscount: l.lineDiscount,
      net: l.net,
      invoiceDiscountShare: share,
      taxable,
      tax: roundDiv(taxable * l.taxBp, 10000),
    };
  });

  const taxTotal = lines.reduce((a, l) => a + l.tax, 0);
  const shipping = Math.max(0, toMinor(input.shipping ?? 0, currency) ?? 0);
  const discountTotal = lineDiscountTotal + invoiceDiscount;
  const total = subtotal - discountTotal + taxTotal + shipping;

  return {
    lines,
    subtotal,
    lineDiscountTotal,
    invoiceDiscount,
    discountTotal,
    taxTotal,
    shipping,
    total: Math.max(0, total),
    issues,
  };
}
