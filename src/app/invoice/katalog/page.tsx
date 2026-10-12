import { redirect } from "next/navigation";
import { CatalogManager } from "@/components/CatalogManager";
import { InvoiceFrame, InvoiceSidebar } from "@/components/InvoiceSidebar";
import { ProblemScreen } from "@/components/ProblemScreen";
import { safeDb } from "@/lib/dbcheck";
import { getInvoiceAccess } from "@/lib/invoice-access";
import { allCategories, listProducts } from "@/lib/invoice-catalog";
import { getInvoiceSettings } from "@/lib/invoice-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Katalog Produk - Print Flow" };

export default async function CatalogPage() {
  const loaded = await safeDb(async () => {
    const access = await getInvoiceAccess();
    if (!access) return null;
    const [products, categories, settings] = await Promise.all([listProducts(), allCategories(), getInvoiceSettings()]);
    return { access, products, categories, settings };
  });
  if (!loaded.ok) return <ProblemScreen problem={loaded.problem} hint="Katalog produk disimpan di database." />;
  if (!loaded.data) redirect("/tidak-diizinkan");
  const { access, products, categories, settings } = loaded.data;

  return (
    <InvoiceFrame sidebar={<InvoiceSidebar businessName={settings.businessName} isOwner={access.isOwner} docType="semua" modeBehavior="filter" />}>
      <CatalogManager initialProducts={products} initialCategories={categories} isOwner={access.isOwner} />
    </InvoiceFrame>
  );
}
