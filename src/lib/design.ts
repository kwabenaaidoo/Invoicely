import { z } from "zod";

// Shared (client + server) invoice design configuration.

export const LAYOUTS = ["MODERN", "MINIMAL", "CORPORATE", "CLASSIC"] as const;
export type Layout = (typeof LAYOUTS)[number];

export const FONTS = {
  inter: { label: "Inter", stack: "'Inter Variable', Inter, 'Helvetica Neue', Arial, sans-serif", file: "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", family: "Inter Variable" },
  "dm-sans": { label: "DM Sans", stack: "'DM Sans Variable', 'DM Sans', 'Helvetica Neue', Arial, sans-serif", file: "@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2", family: "DM Sans Variable" },
  "source-serif": { label: "Source Serif", stack: "'Source Serif 4 Variable', 'Source Serif 4', Georgia, serif", file: "@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2", family: "Source Serif 4 Variable" },
  "jetbrains-mono": { label: "JetBrains Mono", stack: "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace", file: "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2", family: "JetBrains Mono Variable" },
} as const;
export type FontKey = keyof typeof FONTS;
export const FONT_KEYS = Object.keys(FONTS) as [FontKey, ...FontKey[]];

export const COLOR_PRESETS = [
  { name: "Lime", brand: "#84cc16", accent: "#ecfccb" },
  { name: "Emerald", brand: "#10b981", accent: "#d1fae5" },
  { name: "Ocean", brand: "#0ea5e9", accent: "#e0f2fe" },
  { name: "Indigo", brand: "#6366f1", accent: "#e0e7ff" },
  { name: "Slate", brand: "#475569", accent: "#f1f5f9" },
  { name: "Graphite", brand: "#18181b", accent: "#f4f4f5" },
  { name: "Amber", brand: "#f59e0b", accent: "#fef3c7" },
  { name: "Rose", brand: "#e11d48", accent: "#ffe4e6" },
] as const;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color like #84cc16");

export const designSchema = z.object({
  layout: z.enum(LAYOUTS).default("MODERN"),
  brandColor: hex.default("#84cc16"),
  accentColor: hex.default("#ecfccb"),
  font: z.enum(FONT_KEYS).default("inter"),
  footerText: z.string().max(500).default(""),
  show: z
    .object({
      logo: z.boolean().default(true),
      taxNumber: z.boolean().default(true),
      paymentTerms: z.boolean().default(true),
      notes: z.boolean().default(true),
      footer: z.boolean().default(true),
      signature: z.boolean().default(false),
      bankInfo: z.boolean().default(true),
    })
    .default({ logo: true, taxNumber: true, paymentTerms: true, notes: true, footer: true, signature: false, bankInfo: true }),
});

export type Design = z.infer<typeof designSchema>;

export const DEFAULT_DESIGN: Design = designSchema.parse({});

export const SYSTEM_TEMPLATES: { name: string; layout: Layout; design: Design }[] = [
  { name: "Modern", layout: "MODERN", design: { ...DEFAULT_DESIGN, layout: "MODERN", brandColor: "#84cc16", accentColor: "#ecfccb", font: "inter" } },
  { name: "Minimal", layout: "MINIMAL", design: { ...DEFAULT_DESIGN, layout: "MINIMAL", brandColor: "#18181b", accentColor: "#f4f4f5", font: "dm-sans" } },
  { name: "Corporate", layout: "CORPORATE", design: { ...DEFAULT_DESIGN, layout: "CORPORATE", brandColor: "#334155", accentColor: "#f1f5f9", font: "inter", show: { ...DEFAULT_DESIGN.show, signature: true } } },
  { name: "Classic", layout: "CLASSIC", design: { ...DEFAULT_DESIGN, layout: "CLASSIC", brandColor: "#3f6212", accentColor: "#f7fee7", font: "source-serif", show: { ...DEFAULT_DESIGN.show, signature: true } } },
];

/** Pick black or white text for a given background, by relative luminance (WCAG). */
export function readableOn(bg: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return lum > 0.4 ? "#111827" : "#ffffff";
}

/** Darken a hex colour so it is legible as text on white. */
export function textSafe(color: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const lum = (0.299 * r! + 0.587 * g! + 0.114 * b!) / 255;
  if (lum < 0.5) return color;
  const k = 0.55;
  const to = (v: number) => Math.round(v * k).toString(16).padStart(2, "0");
  return `#${to(r!)}${to(g!)}${to(b!)}`;
}
