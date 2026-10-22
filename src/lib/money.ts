// Money helpers. All arithmetic elsewhere is done in integer minor units
// (cents) so totals can never drift because of floating point.

export const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$", exponent: 2 },
  { code: "EUR", name: "Euro", symbol: "€", exponent: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", exponent: 2 },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵", exponent: 2 },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", exponent: 2 },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", exponent: 2 },
  { code: "ZAR", name: "South African Rand", symbol: "R", exponent: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", exponent: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", exponent: 2 },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", exponent: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", exponent: 0 },
  { code: "CNY", name: "Chinese Yuan", symbol: "CN¥", exponent: 2 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", exponent: 2 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", exponent: 2 },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", exponent: 2 },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", exponent: 2 },
  { code: "DKK", name: "Danish Krone", symbol: "kr", exponent: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "AED", exponent: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", exponent: 2 },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", exponent: 2 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", exponent: 2 },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$", exponent: 2 },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as unknown as readonly [CurrencyCode, ...CurrencyCode[]];

export function currencyInfo(code: string) {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

export function exponentOf(code: string) {
  return currencyInfo(code).exponent;
}

/** Integer division with round-half-away-from-zero. */
export function roundDiv(numerator: number, denominator: number) {
  if (denominator === 0) throw new Error("Division by zero");
  const sign = Math.sign(numerator) * Math.sign(denominator);
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);
  return sign * Math.floor((2 * n + d) / (2 * d));
}

/** Parse a user-entered or stored amount into minor units. Returns null if not a finite number. */
export function toMinor(value: number | string | null | undefined, code: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return null;
  const exp = exponentOf(code);
  // Round on the decimal string, not by multiplying floats: 1.005 * 100 is 100.49999…
  // but "1.005000" correctly rounds half-up to 101.
  const [whole = "0", frac = ""] = Math.abs(n).toFixed(exp + 6).split(".");
  const kept = Number(whole + frac.slice(0, exp));
  const roundUp = Number(frac.charAt(exp) || "0") >= 5 ? 1 : 0;
  return Math.sign(n) * (kept + roundUp);
}

/** Minor units to a plain decimal string suitable for Prisma Decimal columns. */
export function minorToDecimal(minor: number, code: string): string {
  const exp = exponentOf(code);
  if (exp === 0) return String(minor);
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 10 ** exp);
  const frac = String(abs % 10 ** exp).padStart(exp, "0");
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

export function minorToNumber(minor: number, code: string): number {
  return minor / 10 ** exponentOf(code);
}

export function formatMinor(minor: number, code: string, locale = "en-US"): string {
  const exp = exponentOf(code);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  }).format(minor / 10 ** exp);
}

/** Format a Decimal-ish value (string | number | Prisma.Decimal) as currency. */
export function formatAmount(value: { toString(): string } | number | string | null | undefined, code: string, locale = "en-US") {
  const minor = toMinor(value === null || value === undefined ? 0 : typeof value === "object" ? value.toString() : value, code) ?? 0;
  return formatMinor(minor, code, locale);
}
