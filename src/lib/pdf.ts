import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import puppeteer, { type Browser } from "puppeteer-core";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import { FONTS } from "./design";
import { env } from "./env";
import type { InvoiceView } from "./invoice-view";

const fontCache = new Map<string, string>();

async function fontFace(key: keyof typeof FONTS) {
  const cached = fontCache.get(key);
  if (cached) return cached;
  const f = FONTS[key];
  const buf = await fs.readFile(path.join(/* turbopackIgnore: true */ process.cwd(), "node_modules", f.file));
  const css = `@font-face{font-family:'${f.family}';font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${buf.toString("base64")}) format('woff2');}`;
  fontCache.set(key, css);
  return css;
}

/** Full standalone HTML document for an invoice (fonts and images inlined — no network needed). */
export async function invoiceHtml(view: InvoiceView) {
  // Imported lazily: Next forbids a static react-dom/server import in the app graph, and this
  // document is rendered to a string on purpose (it is handed to headless Chromium, not the client).
  const { renderToStaticMarkup } = await import("react-dom/server");
  const markup = renderToStaticMarkup(createElement(InvoiceDocument, { view }));
  const css = await fontFace(view.design.font);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Invoice ${escapeAttr(view.number)}</title>
<style>${css}
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
#invoice-print{min-height:297mm !important;max-width:none !important;width:210mm !important}
</style></head><body>${markup}</body></html>`;
}

function escapeAttr(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const g = globalThis as unknown as { __pdfBrowser?: Promise<Browser> };

async function launch(): Promise<Browser> {
  if (env.CHROMIUM_PATH) {
    return puppeteer.launch({
      executablePath: env.CHROMIUM_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
    });
  }
  const { default: chromium } = await import("@sparticuz/chromium");
  return puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: [...chromium.args, "--font-render-hinting=none"],
    headless: "shell",
  });
}

async function getBrowser() {
  if (g.__pdfBrowser) {
    const existing = await g.__pdfBrowser.catch(() => null);
    if (existing?.connected) return existing;
  }
  g.__pdfBrowser = launch();
  return g.__pdfBrowser;
}

export async function renderInvoicePdf(view: InvoiceView): Promise<Buffer> {
  const html = await invoiceHtml(view);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // Nothing in the document needs the network, so block it entirely.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("data:") || url === "about:blank") void req.continue();
      else void req.abort();
    });
    await page.setContent(html, { waitUntil: "load", timeout: 20_000 });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => undefined);
  }
}
