import type { CSSProperties, ReactNode } from "react";
import { calculateInvoice } from "@/lib/invoice-calc";
import { FONTS, readableOn, textSafe } from "@/lib/design";
import { formatMinor, toMinor } from "@/lib/money";
import { STATUS_META } from "@/lib/status";
import type { InvoiceView } from "@/lib/invoice-view";

/**
 * The invoice itself. Deliberately dependency-free (inline styles, no Tailwind, no client hooks):
 * the live preview, the public page and the server-side PDF all render this exact component,
 * which is what keeps the PDF visually identical to what the user designed.
 */

const INK = "#111827";
const MUTED = "#5b6472";
const LINE = "#e5e7eb";

const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
};

function Lines({ value }: { value?: string | null }) {
  if (!value) return null;
  return (
    <>
      {value.split("\n").filter((l) => l.trim()).map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </>
  );
}

export function InvoiceDocument({ view, id = "invoice-print" }: { view: InvoiceView; id?: string }) {
  const { design, currency } = view;
  const brand = design.brandColor;
  const onBrand = readableOn(brand);
  const brandText = textSafe(brand);
  const accent = design.accentColor;
  const font = FONTS[design.font].stack;
  const money = (minor: number) => formatMinor(minor, currency);
  const unit = (n: number) => formatMinor(toMinor(n, currency) ?? 0, currency);

  const calc = calculateInvoice({
    currency,
    items: view.items,
    discountType: view.discountType,
    discountValue: view.discountValue,
    shipping: view.shipping,
  });
  const paid = toMinor(view.amountPaid ?? 0, currency) ?? 0;
  const balance = Math.max(0, calc.total - paid);

  const showTax = view.items.some((i) => i.taxRate > 0);
  const showDiscount = view.items.some((i) => i.discountRate > 0);
  const layout = design.layout;

  const label: CSSProperties = {
    fontSize: 10.5,
    letterSpacing: layout === "MINIMAL" ? "0.14em" : "0.08em",
    textTransform: "uppercase",
    color: MUTED,
    fontWeight: 600,
    marginBottom: 6,
  };
  const small: CSSProperties = { fontSize: 12.5, lineHeight: 1.55, color: INK };

  const status = STATUS_META[view.status];
  const showStamp = view.status !== "DRAFT";

  const root: CSSProperties = {
    width: "100%",
    maxWidth: 794,
    minHeight: 1000,
    margin: "0 auto",
    background: "#ffffff",
    color: INK,
    fontFamily: font,
    fontSize: 13,
    lineHeight: 1.5,
    boxSizing: "border-box",
    position: "relative",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const pad = layout === "CORPORATE" ? "0" : layout === "MINIMAL" ? "56px 56px 48px" : "44px 48px 40px";
  const body: CSSProperties = { padding: layout === "CORPORATE" ? "32px 48px 40px" : pad, flex: 1, display: "flex", flexDirection: "column" };

  const logo = design.show.logo && view.business.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={view.business.logoUrl} alt={`${view.business.name} logo`} style={{ maxHeight: 52, maxWidth: 180, objectFit: "contain", display: "block" }} />
  ) : null;

  const statusPill = showStamp ? (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: layout === "CLASSIC" ? 2 : 999,
        border: `1px solid ${view.status === "PAID" ? brandText : MUTED}`,
        color: view.status === "PAID" ? brandText : MUTED,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      {status.label}
    </span>
  ) : null;

  const businessBlock = (color = INK): ReactNode => (
    <div style={{ ...small, color }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{view.business.name}</div>
      <Lines value={view.business.address} />
      {view.business.email ? <div>{view.business.email}</div> : null}
      {view.business.phone ? <div>{view.business.phone}</div> : null}
      {view.business.website ? <div>{view.business.website}</div> : null}
      {design.show.taxNumber && view.business.taxId ? <div>Tax ID: {view.business.taxId}</div> : null}
    </div>
  );

  const clientBlock = (
    <div style={small}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{view.client.name || "Client name"}</div>
      {view.client.company ? <div>{view.client.company}</div> : null}
      <Lines value={view.client.address} />
      {view.client.email ? <div>{view.client.email}</div> : null}
      {view.client.phone ? <div>{view.client.phone}</div> : null}
      {design.show.taxNumber && view.client.taxId ? <div>Tax ID: {view.client.taxId}</div> : null}
    </div>
  );

  const metaRows: [string, string][] = [
    ["Invoice no.", view.number || "—"],
    ["Issue date", fmtDate(view.issueDate)],
    ["Due date", fmtDate(view.dueDate)],
  ];
  if (view.reference) metaRows.push(["Reference", view.reference]);
  if (design.show.paymentTerms) metaRows.push(["Terms", view.paymentTerms === 0 ? "Due on receipt" : `Net ${view.paymentTerms} days`]);

  const meta = (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 18, rowGap: 4, fontSize: 12.5 }}>
      {metaRows.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <div style={{ color: MUTED }}>{k}</div>
          <div style={{ fontWeight: 600, textAlign: "right" }}>{v}</div>
        </div>
      ))}
    </div>
  );

  const th: CSSProperties = {
    textAlign: "right",
    padding: layout === "CORPORATE" ? "10px 12px" : "10px 8px",
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    ...(layout === "CORPORATE"
      ? { background: brand, color: onBrand }
      : layout === "CLASSIC"
        ? { borderTop: `2px solid ${INK}`, borderBottom: `1px solid ${INK}`, color: INK }
        : layout === "MINIMAL"
          ? { borderBottom: `1px solid ${INK}`, color: MUTED }
          : { borderBottom: `2px solid ${brand}`, color: MUTED }),
  };
  const td = (i: number): CSSProperties => ({
    padding: layout === "CORPORATE" ? "11px 12px" : "12px 8px",
    textAlign: "right",
    verticalAlign: "top",
    fontVariantNumeric: "tabular-nums",
    borderBottom: layout === "CORPORATE" ? "none" : `1px solid ${LINE}`,
    background: layout === "CORPORATE" && i % 2 === 1 ? accent : "transparent",
  });

  const table = (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 28, fontSize: 12.5, tableLayout: "auto" }}>
      <thead>
        <tr>
          <th style={{ ...th, textAlign: "left" }}>Description</th>
          <th style={th}>Qty</th>
          <th style={th}>Rate</th>
          {showDiscount ? <th style={th}>Disc.</th> : null}
          {showTax ? <th style={th}>Tax</th> : null}
          <th style={th}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {view.items.map((item, i) => (
          <tr key={i} style={{ pageBreakInside: "avoid" }}>
            <td style={{ ...td(i), textAlign: "left", width: "42%", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.description || "Item description"}</td>
            <td style={td(i)}>{Number(item.quantity.toFixed(3))}</td>
            <td style={td(i)}>{unit(item.unitPrice)}</td>
            {showDiscount ? <td style={td(i)}>{item.discountRate > 0 ? `${item.discountRate}%` : "—"}</td> : null}
            {showTax ? <td style={td(i)}>{item.taxRate > 0 ? `${item.taxRate}%` : "—"}</td> : null}
            <td style={{ ...td(i), fontWeight: 600 }}>{money(calc.lines[i]?.net ?? 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const totalRow = (k: string, v: string, strong = false): ReactNode => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 24, padding: "5px 0", fontSize: strong ? 14 : 12.5, fontWeight: strong ? 700 : 400 }}>
      <span style={{ color: strong ? INK : MUTED }}>{k}</span>
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: strong ? 700 : 600 }}>{v}</span>
    </div>
  );

  const discountLabel = view.discountType === "PERCENT" && view.discountValue > 0 ? `Discount (${view.discountValue}%)` : "Discount";
  const totalBoxStyle: CSSProperties =
    layout === "MODERN" || layout === "CORPORATE"
      ? { background: brand, color: onBrand, borderRadius: layout === "MODERN" ? 8 : 2, padding: "12px 14px", marginTop: 10 }
      : layout === "CLASSIC"
        ? { borderTop: `2px solid ${INK}`, borderBottom: `2px solid ${INK}`, padding: "10px 0", marginTop: 10 }
        : { borderTop: `1px solid ${INK}`, padding: "12px 0 0", marginTop: 10 };

  const totals = (
    <div style={{ marginLeft: "auto", width: 300, marginTop: 20, breakInside: "avoid" }}>
      {totalRow("Subtotal", money(calc.subtotal))}
      {calc.discountTotal > 0 ? totalRow(discountLabel, `− ${money(calc.discountTotal)}`) : null}
      {calc.taxTotal > 0 ? totalRow("Tax", money(calc.taxTotal)) : null}
      {calc.shipping > 0 ? totalRow("Shipping", money(calc.shipping)) : null}
      <div style={totalBoxStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Total {currency}</span>
          <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{money(calc.total)}</span>
        </div>
      </div>
      {paid > 0 ? (
        <div style={{ marginTop: 8 }}>
          {totalRow("Amount paid", `− ${money(paid)}`)}
          {totalRow("Balance due", money(balance), true)}
        </div>
      ) : null}
    </div>
  );

  const extras = (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 32, breakInside: "avoid" }}>
      {design.show.bankInfo && view.business.paymentInfo ? (
        <div>
          <div style={label}>Payment information</div>
          <div style={{ ...small, whiteSpace: "pre-wrap" }}>{view.business.paymentInfo}</div>
        </div>
      ) : null}
      {design.show.notes && (view.notes || view.terms) ? (
        <div>
          {view.notes ? (
            <>
              <div style={label}>Notes</div>
              <div style={{ ...small, whiteSpace: "pre-wrap", marginBottom: view.terms ? 12 : 0 }}>{view.notes}</div>
            </>
          ) : null}
          {view.terms ? (
            <>
              <div style={label}>Terms</div>
              <div style={{ ...small, whiteSpace: "pre-wrap" }}>{view.terms}</div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const signature = design.show.signature ? (
    <div style={{ marginTop: 36, width: 220, breakInside: "avoid" }}>
      {view.business.signatureUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={view.business.signatureUrl} alt="Authorised signature" style={{ maxHeight: 48, display: "block", marginBottom: 4 }} />
      ) : (
        <div style={{ height: 48 }} />
      )}
      <div style={{ borderTop: `1px solid ${INK}`, paddingTop: 4, fontSize: 11, color: MUTED }}>Authorised signature</div>
    </div>
  ) : null;

  const footerText = design.footerText;
  const footer =
    design.show.footer && footerText ? (
      <div
        style={{
          marginTop: "auto",
          paddingTop: 28,
        }}
      >
        <div
          style={{
            borderTop: `1px solid ${LINE}`,
            paddingTop: 14,
            textAlign: layout === "CLASSIC" ? "center" : "left",
            fontSize: 11.5,
            color: MUTED,
            whiteSpace: "pre-wrap",
          }}
        >
          {footerText}
        </div>
      </div>
    ) : (
      <div style={{ marginTop: "auto" }} />
    );

  const billTo = (
    <div>
      <div style={label}>Billed to</div>
      {clientBlock}
    </div>
  );
  const from = (
    <div>
      <div style={label}>From</div>
      {businessBlock()}
    </div>
  );

  let head: ReactNode;
  if (layout === "CORPORATE") {
    head = (
      <header style={{ background: brand, color: onBrand, padding: "34px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {logo ? <div style={{ background: "#fff", padding: 8, borderRadius: 4 }}>{logo}</div> : null}
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}>{view.business.name}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>Invoice</div>
          <div style={{ fontSize: 12.5, opacity: 0.9 }}>{view.number}</div>
        </div>
      </header>
    );
  } else if (layout === "CLASSIC") {
    head = (
      <header style={{ textAlign: "center", paddingBottom: 18, borderBottom: `3px double ${INK}` }}>
        {logo ? <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>{logo}</div> : null}
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Invoice</div>
        <div style={{ marginTop: 6 }}>{statusPill}</div>
      </header>
    );
  } else if (layout === "MINIMAL") {
    head = (
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
        <div>
          <div style={{ fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED, fontWeight: 600 }}>Invoice</div>
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4 }}>{view.number}</div>
          <div style={{ marginTop: 10 }}>{statusPill}</div>
        </div>
        {logo ?? <div style={{ fontSize: 16, fontWeight: 600 }}>{view.business.name}</div>}
      </header>
    );
  } else {
    head = (
      <>
        <div style={{ height: 6, background: brand, position: "absolute", top: 0, left: 0, right: 0 }} aria-hidden />
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, marginTop: 6 }}>
          <div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05 }}>Invoice</div>
            <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ color: MUTED, fontSize: 13 }}>{view.number}</span>
              {statusPill}
            </div>
          </div>
          {logo ?? <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>{view.business.name}</div>}
        </header>
      </>
    );
  }

  const parties =
    layout === "MODERN" ? (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginTop: 30 }}>
        {from}
        {billTo}
        <div style={{ background: accent, borderRadius: 8, padding: "14px 16px", alignSelf: "start" }}>{meta}</div>
      </div>
    ) : (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginTop: layout === "CORPORATE" ? 0 : 30 }}>
        {from}
        {billTo}
        <div style={layout === "CLASSIC" ? { border: `1px solid ${INK}`, padding: "12px 14px", alignSelf: "start" } : { alignSelf: "start" }}>{meta}</div>
      </div>
    );

  return (
    <div id={id} style={root} data-layout={layout}>
      {head}
      <div style={body}>
        {parties}
        {table}
        {totals}
        {extras}
        {signature}
        {footer}
      </div>
    </div>
  );
}
