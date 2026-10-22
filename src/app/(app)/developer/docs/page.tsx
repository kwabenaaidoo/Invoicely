import type { Metadata } from "next";
import { env } from "@/lib/env";
import { ApiDocs } from "@/components/developer/api-docs";

export const metadata: Metadata = { title: "API Documentation" };

export default function DocsPage() {
  return <ApiDocs baseUrl={env.APP_URL.replace(/\/$/, "")} />;
}
