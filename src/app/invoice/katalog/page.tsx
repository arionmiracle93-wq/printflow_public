import { redirect } from "next/navigation";
import { CatalogScreen } from "@/components/CatalogScreen";
import { ProblemScreen } from "@/components/ProblemScreen";
import { safeDb } from "@/lib/dbcheck";
import { getInvoiceAccess } from "@/lib/invoice-access";
import { allCategories, listProducts } from "@/lib/invoice-catalog";
import { getInvoiceSettings } from "@/lib/invoice-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Katalog Produk - Print Flow" };

export default async function CatalogPage() {
  /* Satu langkah paralel untuk semua query. Sebelumnya akses dicek dulu
     (dua bolak-balik ke database), lalu tiga query lain - sekarang
     semuanya berjalan bersamaan. */
  const loaded = await safeDb(async () => {
    const [access, products, categories, settings] = await Promise.all([
      getInvoiceAccess(),
      listProducts(),
      allCategories(),
      getInvoiceSettings(),
    ]);
    if (!access) return null;
    return { access, products, categories, settings };
  });
  if (!loaded.ok) return <ProblemScreen problem={loaded.problem} hint="Katalog produk disimpan di database." />;
  if (!loaded.data) redirect("/tidak-diizinkan?dari=invoice");
  const { access, products, categories, settings } = loaded.data;

  return (
    <CatalogScreen
      businessName={settings.businessName}
      isOwner={access.isOwner}
      products={products}
      categories={categories}
    />
  );
}
