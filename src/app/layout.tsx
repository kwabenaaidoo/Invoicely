import type { Metadata, Viewport } from "next";
import { ThemeProvider, Toaster } from "@/components/ui/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Invoicely — Professional invoices, paid faster", template: "%s · Invoicely" },
  description: "Create professional invoices, customize them, export PDFs, share secure links and integrate invoicing into your own app with the Invoicely API.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
          Skip to content
        </a>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
