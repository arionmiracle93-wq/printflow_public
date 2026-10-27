"use client";

import { useCallback, useRef, useState } from "react";
import { CatalogDrawerMenu } from "@/components/CatalogDrawerMenu";
import { CatalogManager, type CatalogMenuHandle, type CatalogMenuState } from "@/components/CatalogManager";
import { InvoiceFrame, InvoiceSidebar } from "@/components/InvoiceSidebar";
import type { CatalogItem } from "@/lib/invoice-catalog-match";

/**
 * PEMBUNGKUS HALAMAN KATALOG (client)
 * ===================================================================
 * Menu tiga garis berada di InvoiceSidebar, sedangkan state katalog
 * (kategori aktif, impor, Mode Cepat, kelola kategori) berada di
 * CatalogManager. Keduanya saudara, jadi pembungkus ini yang menjembatani:
 *
 * - CatalogManager melaporkan kategori aktif + jumlah produk lewat
 *   onMenuChange;
 * - menu mobile memanggil aksi CatalogManager lewat ref.
 *
 * Dengan begitu tidak ada state kategori kedua yang bisa berbeda dari
 * daftar produk yang sedang tampil.
 */
export function CatalogScreen({
  businessName,
  isOwner,
  products,
  categories,
}: {
  businessName: string;
  isOwner: boolean;
  products: CatalogItem[];
  categories: string[];
}) {
  const manager = useRef<CatalogMenuHandle>(null);
  const [menu, setMenu] = useState<CatalogMenuState>({
    categories,
    cat: "__all",
    counts: { __all: products.length },
  });

  const onMenuChange = useCallback((next: CatalogMenuState) => setMenu(next), []);

  return (
    <InvoiceFrame
      sidebar={
        <InvoiceSidebar
          businessName={businessName}
          isOwner={isOwner}
          docType="semua"
          modeBehavior="filter"
          hideModeOnMobile
          actions={
            <CatalogDrawerMenu
              categories={menu.categories}
              active={menu.cat}
              counts={menu.counts}
              isOwner={isOwner}
              onSelect={(value) => manager.current?.setCat(value)}
              onImport={() => manager.current?.pickCsv()}
              onDownloadSample={() => manager.current?.downloadSample()}
              onManageCategories={() => manager.current?.openCats()}
              onQuickCreate={() => manager.current?.openQuick()}
            />
          }
        />
      }
    >
      <CatalogManager
        menuRef={manager}
        onMenuChange={onMenuChange}
        initialProducts={products}
        initialCategories={categories}
        isOwner={isOwner}
      />
    </InvoiceFrame>
  );
}
