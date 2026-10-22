import type { Metadata } from "next";
import { Package } from "lucide-react";
import { requireBusiness } from "@/lib/auth/dal";
import { listProducts, serializeProduct } from "@/lib/services/products";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { SearchForm } from "@/components/ui/search-form";
import { AddProductButton, ProductRow } from "@/components/products/product-ui";

export const metadata: Metadata = { title: "Products & Services" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const { business } = await requireBusiness();
  const res = await listProducts(business.id, { q: sp.q?.slice(0, 100), page: Math.max(1, Number(sp.page) || 1), pageSize: 20 });
  const rows = res.rows.map(serializeProduct);
  const cur = business.defaultCurrency;

  return (
    <div className="animate-rise">
      <PageHeader title="Products & Services" description="Your catalogue. Pick items from here while building an invoice." actions={<AddProductButton defaultCurrency={cur} />} />
      {rows.length === 0 && !sp.q ? (
        <EmptyState icon={<Package />} title="No products or services yet" description="Save what you sell once, then add it to invoices in a click." action={<AddProductButton defaultCurrency={cur} />} />
      ) : (
        <>
          <SearchForm action="/products" q={sp.q} placeholder="Search by name or SKU…" label="Search products" />
          {rows.length === 0 ? (
            <EmptyState icon={<Package />} title="No products found" description={`Nothing matches “${sp.q}”.`} />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
                <table className="w-full text-sm">
                  <caption className="sr-only">Products and services</caption>
                  <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Name</th>
                      <th scope="col" className="px-4 py-3 font-medium">SKU</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Unit price</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Tax</th>
                      <th scope="col" className="w-12 px-2 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">{rows.map((p) => <ProductRow key={p.id} product={p} defaultCurrency={cur} variant="row" />)}</tbody>
                </table>
              </div>
              <ul className="flex flex-col gap-3 md:hidden" aria-label="Products and services">{rows.map((p) => <ProductRow key={p.id} product={p} defaultCurrency={cur} variant="card" />)}</ul>
              <Pagination page={res.page} pages={res.pages} total={res.total} pageSize={res.pageSize} basePath="/products" params={{ q: sp.q }} />
            </>
          )}
        </>
      )}
    </div>
  );
}
