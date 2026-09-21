"use client";

import { Camera, ClipboardList, Factory, ImagePlus, MessageCircle, MoreHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";

type TabKey = "ringkasan" | "mitra" | "komunikasi" | "foto" | "lainnya";

export function OrderDetailTabs({
  header,
  ringkasan,
  mitra,
  komunikasi,
  foto,
  lainnya,
  mitraActive,
  komunikasiPending,
}: {
  /** Link "Kembali" + kartu header order — tampil di atas konten tab, di kedua layout. */
  header: ReactNode;
  ringkasan: ReactNode;
  mitra: ReactNode;
  komunikasi: ReactNode;
  foto: ReactNode;
  lainnya: ReactNode;
  /** Ada produksi mitra yang masih berjalan (belum "Diterima"). */
  mitraActive: boolean;
  /** Ada serah terima yang belum diterima operator tujuan. */
  komunikasiPending: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("ringkasan");

  const tabs: { key: TabKey; label: string; icon: ReactNode; indicator?: ReactNode }[] = [
    { key: "ringkasan", label: "Ringkasan", icon: <ClipboardList size={17} /> },
    {
      key: "mitra",
      label: "Mitra",
      icon: <Factory size={17} />,
      indicator: mitraActive ? (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500" aria-label="Ada produksi mitra berjalan" />
      ) : undefined,
    },
    {
      key: "komunikasi",
      label: "Komunikasi",
      icon: <MessageCircle size={17} />,
      indicator: komunikasiPending ? (
        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-black text-white" aria-label="Ada serah terima menunggu">
          !
        </span>
      ) : undefined,
    },
    { key: "foto", label: "Foto", icon: <Camera size={17} /> },
    { key: "lainnya", label: "Lainnya", icon: <MoreHorizontal size={17} /> },
  ];

  const activeContent =
    tab === "ringkasan" ? ringkasan : tab === "mitra" ? mitra : tab === "komunikasi" ? komunikasi : tab === "foto" ? foto : lainnya;

  return (
    <div className="xl:grid xl:grid-cols-[232px_minmax(0,1fr)_380px] xl:gap-5">
      {/* ============================================================
          Kolom tengah — header (baris 1) & konten tab aktif (baris 2).
          Sama persis di HP/tablet maupun desktop, cuma posisinya yang
          dipindah lewat grid di layar xl (>=1280px).
          ============================================================ */}
      <div className="space-y-4 mb-4 xl:col-start-2 xl:row-start-1 xl:mb-0">{header}</div>

      {/* ============================================================
          Tab bar horizontal — HP & tablet (<xl). Tidak ada perubahan
          sama sekali dari versi sebelumnya.
          ============================================================ */}
      <div className="xl:hidden">
        <div className="sticky top-[60px] z-30 -mx-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md dark:border-white/10 dark:bg-[#081420]/95 md:sticky md:top-16 md:z-20 md:mx-0 md:rounded-t-2xl md:border-x md:border-t">
          <div className="grid grid-cols-5">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`relative flex flex-col items-center gap-1 border-b-2 px-1 py-2.5 text-[10.5px] font-bold transition ${
                  tab === t.key
                    ? "border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300"
                    : "border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                }`}
              >
                <span className="relative">
                  {t.icon}
                  {t.indicator}
                </span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================
          Sidebar menu tab vertikal — CUMA desktop (xl, >=1280px).
          Tombol yang sama, cuma tampilannya beda (vertikal, bukan
          pil horizontal) supaya jadi kolom pertama.
          ============================================================ */}
      <div className="hidden xl:col-start-1 xl:row-start-1 xl:row-span-2 xl:block xl:self-start xl:sticky xl:top-20">
        <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[.12em] text-slate-400 dark:text-slate-500">Navigation</p>
        <nav className="flex flex-col gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold transition ${
                tab === t.key
                  ? "bg-teal-600 text-white shadow-[0_6px_16px_rgba(13,148,136,.3)] dark:bg-teal-500"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
              }`}
            >
              <span className="relative shrink-0">
                {t.icon}
                {t.indicator}
              </span>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ============================================================
          Konten tab aktif — SATU render dipakai bareng HP/tablet
          maupun desktop (cuma dipindah posisinya via grid di xl),
          supaya komponen di dalamnya (form, manager foto, dll) tidak
          ke-mount dua kali.
          ============================================================ */}
      <div className="space-y-4 py-4 md:rounded-b-2xl md:border-x md:border-b md:border-slate-200 md:px-4 md:dark:border-white/10 xl:col-start-2 xl:row-start-2 xl:min-w-0 xl:rounded-none xl:border-0 xl:px-0 xl:py-0">
        {activeContent}
      </div>

      {/* ============================================================
          Placeholder foto — CUMA desktop (xl), tampil di semua tab.
          Tinggal diganti manual dengan foto asli kapan pun siap.
          ============================================================ */}
      <div className="hidden xl:col-start-3 xl:row-start-1 xl:row-span-2 xl:block xl:self-start xl:sticky xl:top-20">
        <OrderPhotoPlaceholder />
      </div>
    </div>
  );
}

function OrderPhotoPlaceholder() {
  return (
    <div className="panel-glass relative isolate flex h-[calc(100vh-6.5rem)] flex-col items-center justify-center gap-3 overflow-hidden border-dashed px-6 text-center">
      <div className="pointer-events-none absolute -left-10 -top-10 -z-10 h-48 w-48 rounded-full bg-teal-400/15 blur-3xl dark:bg-teal-400/10" />
      <div className="pointer-events-none absolute -bottom-14 -right-10 -z-10 h-52 w-52 rounded-full bg-amber-300/15 blur-3xl dark:bg-amber-300/10" />
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-teal-300 text-teal-500 dark:border-white/25 dark:text-teal-300">
        <ImagePlus size={24} />
      </span>
      <div>
        <p className="text-sm font-extrabold text-slate-600 dark:text-slate-200">Placeholder foto</p>
        <p className="mx-auto mt-1 max-w-[220px] text-xs leading-relaxed text-slate-400 dark:text-slate-400">
          Ganti area ini dengan foto pekerjaan / percetakan Anda sendiri.
        </p>
      </div>
    </div>
  );
}
