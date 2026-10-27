"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * CANGKANG POPUP (dipakai kalender DAN pemilih jam)
 * ===================================================================
 * Berisi semua pekerjaan yang sulit dan tidak layak diduplikasi:
 *
 * 1. PANEL DIPINDAHKAN KE document.body lewat portal.
 *    Alasannya pemotongan, bukan kecepatan. Panelnya `absolute`, jadi
 *    ia ikut terpotong oleh leluhur mana pun yang punya overflow.
 *    Di editor invoice ada `.ppi-meta { overflow: hidden }`
 *    (globals.css) - popup kalender di dalam kotak meta itu terpotong
 *    jadi beberapa piksel saja: yang terlihat cuma baris tombol tutup
 *    dan sedikit kepala, sisanya hilang di dalam kotak.
 *
 *    Portal + `position: fixed` membuat panel tidak punya leluhur
 *    sama sekali di dalam DOM, jadi tidak ada yang bisa memotongnya.
 *
 * 2. SEMUA POSISI DIHITUNG DI SINI, lalu disimpan sebagai satu objek
 *    gaya. Karena posisinya `fixed`, koordinatnya berasal dari viewport.
 *    Panel tidak lagi ikut bergerak sendiri saat halaman digulir, jadi
 *    posisinya dihitung ulang saat scroll, saat jendela diubah ukuran,
 *    dan setiap kali lebarnya berubah (lebar memengaruhi tinggi panel,
 *    yang memengaruhi arahnya).
 *
 * 3. DUA HAL YANG SEBELUMNYA SALAH, dan akibatnya sama: popup naik
 *    menutupi header.
 *
 *    3a. Ruang di atas TIDAK diukur dari y=0. Ada header lengket
 *        setinggi 56px lebih yang menutupi bagian atas layar. Kalau
 *        ruang atas dihitung dari b.top langsung ke y=0, ruang itu
 *        dikira 56px lebih besar dari kenyataannya - cukup untuk membuat
 *        popup memutuskan naik, padahal kalau naik ia akan menutupi
 *        header dan tombol navigasi.
 *
 *    3b. Dulu, "bawah < tinggi_panel" sudah cukup untuk naik. Kurang
 *        SEDIKIT saja, popup pun naik walaupun bawahnya masih hampir
 *        muat - dan menutupi header sebagai gantinya. Sekarang bawah
 *        diutamakan, dan naik hanya kalau bawah memang tidak muat
 *        sementara ruang atas yang BERSIH dari header cukup.
 *
 * 4. maxHeight HANYA dipasang kalau ruangnya benar-benar lebih kecil
 *    dari tinggi panel. Dulu selalu dipasang, dengan nilai yang sama
 *    persis dengan tinggi panel yang baru diukur. Karena angka itu hasil
 *    pecahan, kadang kurang satu piksel dan muncul bilah gulir - padahal
 *    isinya sudah muat semua.
 *
 * 5. TUTUP SENDIRI: klik di luar atau tekan Escape.
 *
 *    "Di dalam" diuji ke KEDUA elemen: pembungkus isian dan panelnya.
 *    Panel ada di document.body, jadi ia bukan anak dari pembungkus.
 *    Kalau hanya pembungkus yang diuji, setiap ketukan di tanggal atau
 *    jam terbaca sebagai klik di luar: popup menutup pada mousedown,
 *    dan click-nya sendiri tidak pernah sampai ke tombol.
 */

/** Lebar panel kalau ruangnya memang cukup. 300px supaya bentuknya
    tidak berubah di layar yang cukup lebar. */
const LEBAR_IDEAL = 300;
/** Batas bawah. Tujuh kolom kalender jadi sekitar 33px per kolom, dan
    kepala bulan masih muat. */
const LEBAR_MIN = 232;
/** Jarak aman dari tepi layar, supaya panel tidak menempel persis di
    tepi yang terlihat seperti terpotong. */
const MARGIN = 8;
/** Jarak antara field dan panel. Dulu mt-1.5 / mb-1.5. */
const JARAK = 6;
/** Batas bawah tinggi panel yang masih enak dipakai. Di bawah ini panel
    jadi sempit sekali dan harus digulir terus. */
const TINGGI_MIN = 200;

/** Bentuk gaya panel. Semua angka koordinat viewport, karena panel
    dipindahkan ke document.body dan diposisikan `fixed`. */
type GayaPanel = {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  width?: number;
  maxHeight?: number;
};

export function PopoverPanel({
  children,
  isi,
  label,
  onTutup,
  lebarMinimum,
}: {
  /** Isian dan tombol pemicunya. TETAP tinggal di tempatnya - panel
      tidak boleh membawanya ikut ke document.body, karena kalau ikut,
      pemicunya ikut terpotong bersama panel. */
  children: ReactNode;
  /** Yang ditampilkan di dalam panel. */
  isi: ReactNode;
  /** Nama untuk pembaca layar, BUKAN teks yang ditampilkan di panel. */
  label: string;
  onTutup: () => void;
  /** Lebar minimum khusus isi tertentu. Pemilih jam lebih sempit
      daripada kalender, jadi ia butuh turunannya sendiri. */
  lebarMinimum?: number;
}) {
  const bungkusRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [gaya, setGaya] = useState<GayaPanel | null>(null);
  /* Target portal dibaca sekali lewat lazy initializer, bukan di dalam
     useEffect + setState: aturan React melarang pemanggilan setState
     langsung di dalam effect, dan tidak perlu - document.body sudah ada
     sejak render pertama di sisi klien.

     Sisi server aman: PopoverPanel hanya dirender kalau popup terbuka,
     dan popup hanya bisa dibuka lewat klik pengguna. Jadi saat SSR
     komponen ini tidak pernah ikut dirender sama sekali. */
  const [portal] = useState<HTMLElement | null>(() => (typeof document === "undefined" ? null : document.body));

  useEffect(() => {
    const bungkus = bungkusRef.current;
    if (!bungkus) return;
    const diDalam = (t: Node | null) =>
      Boolean(t) && (bungkus.contains(t as Node) || panelRef.current?.contains(t as Node));
    const luar = (e: MouseEvent | TouchEvent) => {
      if (!diDalam(e.target as Node)) onTutup();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      onTutup();
      bungkus.querySelector<HTMLElement>("input, button, [tabindex]")?.focus();
    };
    document.addEventListener("mousedown", luar);
    document.addEventListener("touchstart", luar);
    window.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", luar);
      document.removeEventListener("touchstart", luar);
      window.removeEventListener("keydown", escape);
    };
  }, [onTutup]);

  const hitung = useCallback(() => {
    const bungkus = bungkusRef.current;
    const panel = panelRef.current;
    if (!bungkus || !panel) return;
    const b = bungkus.getBoundingClientRect();
    const p = panel.getBoundingClientRect();

    // Sisi: pakai ruang terbesar yang tersedia.
    const ruangKanan = window.innerWidth - b.right - MARGIN;
    const ruangKiri = b.left - MARGIN;
    const sisiBaru = ruangKanan >= ruangKiri ? "kiri" : "kanan";
    const minimum = Math.max(LEBAR_MIN, lebarMinimum ?? 0);
    const lebarBaru =
      Math.max(ruangKanan, ruangKiri) >= LEBAR_IDEAL
        ? LEBAR_IDEAL
        : Math.max(minimum, sisiBaru === "kiri" ? ruangKanan : ruangKiri);

    // Arah: header lengket menutupi bagian atas, jadi ruang atas diukur
    // dari bawah header - bukan dari y=0.
    const header = document.querySelector<HTMLElement>("header.sticky");
    const dasarAtas = header ? header.getBoundingClientRect().bottom : 0;
    const bawah = window.innerHeight - b.bottom - MARGIN;
    const atas = b.top - dasarAtas - MARGIN;

    const arahBaru = bawah < p.height && atas >= p.height ? "atas" : "bawah";
    const ruang = arahBaru === "atas" ? atas : bawah;

    setGaya({
      left: sisiBaru === "kiri" ? b.left : undefined,
      right: sisiBaru === "kanan" ? window.innerWidth - b.right : undefined,
      top: arahBaru === "bawah" ? b.bottom + JARAK : undefined,
      bottom: arahBaru === "atas" ? window.innerHeight - b.top + JARAK : undefined,
      width: lebarBaru,
      maxHeight: ruang < p.height ? Math.max(ruang, TINGGI_MIN) : undefined,
    });
  }, [lebarMinimum]);

  useLayoutEffect(() => {
    hitung();
    const ulang = () => hitung();
    window.addEventListener("scroll", ulang, true);
    window.addEventListener("resize", ulang);
    return () => {
      window.removeEventListener("scroll", ulang, true);
      window.removeEventListener("resize", ulang);
    };
  }, [hitung, gaya?.width]);

  return (
    <div className="relative" ref={bungkusRef}>
      {children}
      {portal
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={label}
              style={{
                position: "fixed",
                left: gaya?.left,
                right: gaya?.right,
                top: gaya?.top,
                bottom: gaya?.bottom,
                width: gaya?.width,
                maxHeight: gaya?.maxHeight,
              }}
                            /* z-index DI ATAS semua lapisan yang ada di aplikasi.

                 Panel popup ini dipindah ke document.body, jadi ia tidak
                 lagi ikut di dalam hierarki z-index tempat asalnya. Kalau
                 z-indexnya tetap yang lama (90), panel ini akan tertutup
                 oleh apa saja yang lebih tinggi - termasuk panel cari
                 di header yang memakai z-110 dengan latar gelap.

                 Gejalanya:
                 - Grid bulan TETAP muncul, tapi separuh atasnya tertutup
                   panel cari, jadi yang kelihatan hanya baris paling
                   bawah (mis. Jul/Agu/Sep).
                 - Isinya tampak redup, karena yang di atasnya adalah
                   latar panel yang 80% gelap.

                 Nilainya 210: di atas z-200, yang dipakai lapisan
                 tertinggi di aplikasi ini (ExitOnBackConfirm,
                 NavigationFeedback, OrderItemsEditor). Popup harus
                 selalu terlihat di atas apa pun - kalau tidak, ia
                 hanya bisa dibuka di tempat yang tidak ada lapis lain.

                 Sama seperti Select (z-150) yang juga portal ke
                 document.body: dropdown harus di atas modalnya. */
              className="pf-pop-cal z-[210] overflow-y-auto overscroll-contain"
            >
              {/* Tidak ada judul di atas panel. Sempat ada teks "Pilih
                  tanggal" di sini, dan di HP baris itu hanya memakan
                  tinggi tanpa memberi informasi apa pun - tombol pemicu
                  sudah bertulis nilai, jadi maksudnya sudah jelas.

                  Yang tersisa cuma tombol tutup, diperkecil dan
                  dirapatkan ke kanan supaya tidak terasa seperti baris
                  kosong.

                  label tetap dipasang sebagai aria-label supaya pembaca
                  layar tetap punya nama untuk dialog ini. */}
              <div className="mb-1 flex items-center justify-end">
                <button
                  type="button"
                  onClick={onTutup}
                  aria-label="Tutup"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[color:var(--pf-surface-3)] text-[color:var(--pf-ink-2)] transition hover:bg-[color:var(--pf-surface-2)]"
                >
                  <X size={15} strokeWidth={2.3} />
                </button>
              </div>
              {isi}
            </div>,
            portal,
          )
        : null}
    </div>
  );
}
