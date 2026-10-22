import { describe, expect, it } from "vitest";
import { calculateInvoice } from "./invoice-calc";
import { formatMinor, minorToDecimal, roundDiv, toMinor } from "./money";

describe("money helpers", () => {
  it("rounds half away from zero", () => {
    expect(roundDiv(5, 2)).toBe(3);
    expect(roundDiv(-5, 2)).toBe(-3);
    expect(roundDiv(4, 3)).toBe(1);
  });

  it("parses amounts without float noise", () => {
    expect(toMinor(1.005, "USD")).toBe(101);
    expect(toMinor("19.99", "USD")).toBe(1999);
    expect(toMinor("1,234.50", "USD")).toBe(123450);
    expect(toMinor(1500, "JPY")).toBe(1500);
    expect(toMinor("abc", "USD")).toBeNull();
  });

  it("formats minor units", () => {
    expect(minorToDecimal(1999, "USD")).toBe("19.99");
    expect(minorToDecimal(5, "USD")).toBe("0.05");
    expect(minorToDecimal(1500, "JPY")).toBe("1500");
    expect(formatMinor(123456, "USD")).toBe("$1,234.56");
  });
});

describe("calculateInvoice", () => {
  it("computes a simple taxed invoice", () => {
    const r = calculateInvoice({
      currency: "USD",
      items: [
        { quantity: 2, unitPrice: 50, taxRate: 10 },
        { quantity: 1, unitPrice: 25.5, taxRate: 0 },
      ],
      shipping: 5,
    });
    expect(r.subtotal).toBe(12550);
    expect(r.taxTotal).toBe(1000);
    expect(r.total).toBe(12550 + 1000 + 500);
  });

  it("applies line discounts before tax", () => {
    const r = calculateInvoice({
      currency: "USD",
      items: [{ quantity: 1, unitPrice: 200, taxRate: 20, discountRate: 10 }],
    });
    expect(r.lines[0]!.net).toBe(18000);
    expect(r.taxTotal).toBe(3600);
    expect(r.total).toBe(21600);
  });

  it("allocates a percentage invoice discount across lines and taxes the discounted base", () => {
    const r = calculateInvoice({
      currency: "USD",
      items: [
        { quantity: 1, unitPrice: 100, taxRate: 10 },
        { quantity: 1, unitPrice: 100, taxRate: 0 },
      ],
      discountType: "PERCENT",
      discountValue: 10,
    });
    expect(r.invoiceDiscount).toBe(2000);
    expect(r.lines.map((l) => l.invoiceDiscountShare)).toEqual([1000, 1000]);
    expect(r.taxTotal).toBe(900);
    expect(r.total).toBe(20000 - 2000 + 900);
  });

  it("distributes fixed discounts exactly with no lost cents", () => {
    const r = calculateInvoice({
      currency: "USD",
      items: [
        { quantity: 1, unitPrice: 10 },
        { quantity: 1, unitPrice: 10 },
        { quantity: 1, unitPrice: 10 },
      ],
      discountType: "FIXED",
      discountValue: 1,
    });
    expect(r.lines.reduce((a, l) => a + l.invoiceDiscountShare, 0)).toBe(100);
    expect(r.total).toBe(3000 - 100);
  });

  it("caps a fixed discount that exceeds the subtotal and never goes negative", () => {
    const r = calculateInvoice({
      currency: "USD",
      items: [{ quantity: 1, unitPrice: 10 }],
      discountType: "FIXED",
      discountValue: 50,
    });
    expect(r.invoiceDiscount).toBe(1000);
    expect(r.total).toBe(0);
    expect(r.issues.length).toBe(1);
  });

  it("ignores negative and invalid inputs", () => {
    const r = calculateInvoice({
      currency: "USD",
      items: [{ quantity: -3, unitPrice: -10, taxRate: 500, discountRate: -5 }],
      shipping: -20,
    });
    expect(r.subtotal).toBe(0);
    expect(r.shipping).toBe(0);
    expect(r.total).toBe(0);
  });

  it("handles fractional quantities and zero-decimal currencies", () => {
    const r = calculateInvoice({
      currency: "JPY",
      items: [{ quantity: 1.5, unitPrice: 1001, taxRate: 10 }],
    });
    expect(r.subtotal).toBe(1502);
    expect(r.taxTotal).toBe(150);
    expect(r.total).toBe(1652);
  });

  it("keeps totals consistent: subtotal - discounts + tax + shipping", () => {
    const r = calculateInvoice({
      currency: "EUR",
      items: [
        { quantity: 3, unitPrice: 33.33, taxRate: 19, discountRate: 5 },
        { quantity: 7, unitPrice: 12.49, taxRate: 7, discountRate: 0 },
        { quantity: 0.25, unitPrice: 999.99, taxRate: 0, discountRate: 12.5 },
      ],
      discountType: "PERCENT",
      discountValue: 7.5,
      shipping: 12.34,
    });
    expect(r.total).toBe(r.subtotal - r.discountTotal + r.taxTotal + r.shipping);
    expect(r.taxTotal).toBe(r.lines.reduce((a, l) => a + l.tax, 0));
  });
});
