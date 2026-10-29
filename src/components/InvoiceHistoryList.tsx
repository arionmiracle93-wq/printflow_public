"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Grid3x3, LayoutGrid, List, Table } from "lucide-react";
import { ExpandingTabs, type ExpandingTabItem } from "@/components/ExpandingTabs";
import { InvoiceHistoryCard, InvoiceHistoryRow, type InvoiceHistoryCardRow } from "@/components/InvoiceHistoryCard";
import { InvoiceHistoryTable } from "@/components/InvoiceHistoryTable";

/* Pilihan tampilan riwayat invoice. Dipisah dari kunci katalog supaya
   pilihan di modul Invoice tidak mengubah tampilan katalog, dan sebaliknya.
   Bawaan "kartu" = tampilan yang sudah dipakai selama ini. */
const VIEW_KEY = "pf-invoice-riwayat-tampilan";
const VIEW_EVENT = "pf-invoice-riwayat-tampilan-berubah";
type View = "kartu" | "padat" | "ringkas" | "tabel";

/* Cadangan bila browser menolak localStorage: pilihan tetap berlaku
   sampai halaman ditutup, hanya tidak diingat. */
let fallbackView: View = "kartu";

function viewSnapshot(): View {
  try {
    const saved = window.localStorage.getItem(VIEW_KEY);
    return saved === "kartu" || saved === "padat" || saved === "ringkas" || saved === "tabel" ? saved : "kartu";
  } catch {
    return fallbackView;
  }
}

/** Server tidak punya localStorage: pakai tampilan bawaan. */
function serverViewSnapshot(): View {
  return "kartu";
}

function subscribeView(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(VIEW_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(VIEW_EVENT, cb);
  };
}

/* Lebar layar via media query (lg ke atas) untuk menawarkan/aktifkan mode
   Tabel. Server memandang sempit: tab Tabel barulah muncul setelah
   hidrasi di layar lebar — sama sifatnya dengan pemulihan pilihan
   tersimpan yang juga dilakukan setelah hidrasi. */
const WIDE_QUERY = "(min-width: 1024px)";
function subscribeWide(cb: () => void) {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const wideSnapshot = (): boolean => window.matchMedia(WIDE_QUERY).matches;
const wideServerSnapshot = (): boolean => false;

/**
 * Daftar dokumen di halaman Riwayat (/invoice) beserta pemilih tampilan.
 *
 * Empat pilihan, satu pola dengan modul Katalog:
 *  - Kartu  : kartu lengkap (bawaan, sama seperti sebelumnya)
 *  - Padat  : kartu kecil tanpa baris detail, lebih banyak per layar
 *  - Ringkas: daftar baris, paling rapat
 *  - Tabel  : tabel kolom ala POS (diminta owner) - nomor, tanggal,
 *             pelanggan, pekerjaan, status, uang, aksi — hanya di layar
 *             lebar (lg ke atas); di HP tersedia tiga pilihan lain.
 *
 * Pilihan disimpan di perangkat dan dibaca lewat useSyncExternalStore,
 * jadi server merender "kartu" lebih dulu lalu browser memakai pilihan
 * tersimpan tanpa memicu peringatan ketidakcocokan hidrasi.
 */
export function InvoiceHistoryList({
  rows,
  today,
  uniqueCodeEnabled,
}: {
  rows: InvoiceHistoryCardRow[];
  today: string;
  uniqueCodeEnabled: boolean;
}) {
  const view = useSyncExternalStore(subscribeView, viewSnapshot, serverViewSnapshot);

  /* Tabel cuma ditawarkan di layar lebar (lg ke atas) — kolomnya butuh
     lebar; di HP hilang, dan bila pilihan tersimpan memang "tabel",
     isinya dikembalikan ke "kartu" tanpa menghapus pilihan tersimpan
     (di desktop tabel kembali sendiri). Permintaan owner. */
  const isWide = useSyncExternalStore(subscribeWide, wideSnapshot, wideServerSnapshot);
  const shownView: View = view === "tabel" && !isWide ? "kartu" : view;
  const items = useMemo(() => {
    const base: ExpandingTabItem<View>[] = [
      { value: "kartu", label: "Kartu", icon: <LayoutGrid size={16} />, title: "Tampilan kartu (informasi lengkap)" },
      { value: "padat", label: "Padat", icon: <Grid3x3 size={16} />, title: "Tampilan padat (kartu kecil, lebih banyak dokumen terlihat)" },
      { value: "ringkas", label: "Ringkas", icon: <List size={16} />, title: "Tampilan ringkas (daftar baris)" },
    ];
    if (isWide) base.push({ value: "tabel", label: "Tabel", icon: <Table size={16} />, title: "Tampilan tabel (satu baris per dokumen, mudah dipindai per kolom)" });
    return base;
  }, [isWide]);

  const setView = (v: View) => {
    fallbackView = v;
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* abaikan */
    }
    window.dispatchEvent(new Event(VIEW_EVENT));
  };

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Menampilkan {rows.length} dokumen</span>
        <ExpandingTabs<View>
          ariaLabel="Tampilan riwayat invoice"
          value={shownView}
          onChange={setView}
          items={items}
        />
      </div>

      {shownView === "tabel" ? (
        <InvoiceHistoryTable rows={rows} today={today} uniqueCodeEnabled={uniqueCodeEnabled} />
      ) : shownView === "ringkas" ? (
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2 2xl:grid-cols-3">
          {rows.map((row) => (
            <InvoiceHistoryRow key={row.id} row={row} today={today} uniqueCodeEnabled={uniqueCodeEnabled} />
          ))}
        </div>
      ) : shownView === "padat" ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rows.map((row) => (
            <InvoiceHistoryCard key={row.id} row={row} today={today} uniqueCodeEnabled={uniqueCodeEnabled} variant="padat" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <InvoiceHistoryCard key={row.id} row={row} today={today} uniqueCodeEnabled={uniqueCodeEnabled} />
          ))}
        </div>
      )}
    </div>
  );
}
