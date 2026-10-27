"use client";

import { ArrowRight, Camera, ClipboardList, Factory, History, MessageCircle, MoreHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";

type TabKey = "ringkasan" | "mitra" | "komunikasi" | "foto" | "lainnya";

export function OrderDetailTabs({
  header,
  ringkasan,
  mitra,
  komunikasi,
  foto,
  lainnya,
  rail,
  activity,
  mitraActive,
  komunikasiPending,
}: {
  /** Link "Kembali" + kartu header order - tampil di atas konten tab, di kedua layout. */
  header: ReactNode;
  ringkasan: ReactNode;
  mitra: ReactNode;
  komunikasi: ReactNode;
  foto: ReactNode;
  lainnya: ReactNode;
  /** Kartu-kartu "sekilas pekerjaan" untuk panel kanan (cuma tampil di >=1280px / xl, semua tab). */
  rail: ReactNode;
  /** Isi daftar aktivitas terbaru; dibungkus kartu + tombol "lihat semua" di sini. */
  activity: ReactNode;
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
        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white" aria-label="Ada serah terima menunggu">
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
    /* ================================================================
       BATAS LEBAR HALAMAN - ini kunci supaya konten tidak "melar".

       Dulu kolom tengah memakai minmax(0,1fr) tanpa batas atas, dan
       lebarnya "dijaga" oleh kolom foto 380px di kanan. Begitu kolom
       foto dibuang, 1fr itu mengambil SEMUA sisa ruang (di monitor
       lebar jadi ~1140px) - kartu, grid info, dan form ikut tertarik.

       Sekarang lebar dibatasi langsung di pembungkus, bukan di kolom
       tetangga, dan kolom kanan diisi panel "sekilas pekerjaan":
         - < xl (<1280px): satu kolom, maks 880px, rata tengah.
                           (HP tidak terpengaruh: layarnya < 880px.)
         - >= xl         : tiga kolom - menu 216px | konten | panel
                           312px. Konten mengisi sisanya: ~650px di
                           layar 1280px, mentok ~815px di layar >=1440px
                           (karena <main> dibatasi 1440px). Jadi konten
                           tidak pernah melar di monitor selebar apa pun.

       Mau lebih lebar/sempit? Ubah angka di className di bawah:
         max-w-[880px]   -> lebar konten di bawah xl
         216px / 312px   -> lebar menu kiri / panel kanan
         grid-rows-[auto_1fr] -> JANGAN dihapus: tanpa ini panel kanan
                         (tinggi, span 2 baris) melarkan baris header
                         dan muncul celah kosong di bawah kartu invoice.
       ================================================================ */
    <div className="mx-auto w-full max-w-[880px] xl:grid xl:max-w-[1392px] xl:grid-cols-[216px_minmax(0,1fr)_312px] xl:grid-rows-[auto_1fr] xl:gap-x-6 xl:gap-y-4">
      {/* ============================================================
          Kolom konten - header (baris 1) & konten tab aktif (baris 2).
          Sama persis di HP/tablet maupun desktop, cuma posisinya yang
          dipindah lewat grid di layar xl (>=1280px).
          ============================================================ */}
      <div className="space-y-4 mb-4 xl:col-start-2 xl:row-start-1 xl:mb-0">{header}</div>

      {/* ============================================================
          Tab bar horizontal - HP & tablet (<xl). Tidak ada perubahan
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
          Sidebar menu tab vertikal - CUMA desktop (xl, >=1280px).
          Tombol yang sama, cuma tampilannya beda (vertikal, bukan
          pil horizontal) supaya jadi kolom pertama. Menempel (sticky)
          saat halaman digulir.
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
          Konten tab aktif - SATU render dipakai bareng HP/tablet
          maupun desktop (cuma dipindah posisinya via grid di xl),
          supaya komponen di dalamnya (form, manager foto, dll) tidak
          ke-mount dua kali.
          ============================================================ */}
      <div className="space-y-4 py-4 md:rounded-b-2xl md:border-x md:border-b md:border-slate-200 md:px-4 md:dark:border-white/10 xl:col-start-2 xl:row-start-2 xl:min-w-0 xl:rounded-none xl:border-0 xl:px-0 xl:py-0">
        {activeContent}
      </div>

      {/* ============================================================
          Panel "sekilas pekerjaan" - CUMA layar >=1280px (xl), tampil di
          SEMUA tab dan menempel (sticky) saat halaman digulir. Isinya
          info yang paling sering dicek (sisa waktu, tagihan, detail,
          aktivitas terakhir) supaya tidak perlu pindah tab dulu.
          max-h + overflow: di laptop yang layarnya pendek, panel bisa
          digulir sendiri, jadi kartu paling bawah tidak terpotong.
          ============================================================ */}
      <aside
        aria-label="Sekilas pekerjaan"
        className="hidden xl:sticky xl:top-20 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:-m-1 xl:block xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto xl:p-1"
      >
        <div className="space-y-4">
          {rail}
          <div className="card p-4">
            <p className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <History size={12} /> Aktivitas terakhir
            </p>
            {activity}
            <button
              type="button"
              onClick={() => setTab("lainnya")}
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:underline dark:text-teal-300"
            >
              Lihat semua riwayat <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
