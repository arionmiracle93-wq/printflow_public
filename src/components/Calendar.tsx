"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * KALENDER APLIKASI
 * ===================================================================
 * Pengganti kalender bawaan browser (popup OS) di seluruh aplikasi.
 *
 * Kenapa kalender sendiri, bukan bawaan perangkat:
 * - Popup OS tidak bisa diberi gaya. Di mode gelap ia tetap memakai
 *   warna sistem operasi, sehingga muncul sebagai kotak terang di
 *   tengah aplikasi yang gelapnya sendiri.
 * - Format tampilannya mengikuti locale perangkat, bukan kode kita.
 * - Di HP popup-nya menutup halaman dan menutupi hampir seluruh layar
 *   hanya untuk memilih satu tanggal.
 *
 * Kenapa ditulis tanpa dependensi baru
 * ----------------------------------
 * Referensi aslinya memakai framer-motion, @tabler/icons-react, clsx,
 * dan tailwind-merge. Empat paket itu tidak ada di proyek ini dan
 * tidak perlu ada:
 * - Ikon: proyek ini sudah memakai lucide-react. Keduanya ikon garis
 *   yang sama; hanya bedanya nama.
 * - Animasi: halaman ini tidak punya framer-motion, dan paket sebesar
 *   itu tidak sebanding dengan satu transisi CSS untuk pindah bulan.
 * - clsx + tailwind-merge: dipakai untuk menggabung kelas. Di sini
 *   kelas ditulis sebagai string biasa, jadi satu fungsi join 3 baris
 *   di bawah ini cukup.
 *
 * Format nilainya tetap ISO "yyyy-mm-dd" (dan "yyyy-mm" untuk mode
 * bulan) - sama seperti yang sudah dipakai DateFieldID, state, dan
 * body API. Tidak ada yang berubah di belakang layar.
 */

export type ModeKalender = "single" | "range" | "month";

export type RentangKalender = { dari?: string; sampai?: string };

type NilaiKalender = string | RentangKalender | undefined;

function cx(...v: (string | false | null | undefined)[]) {
  return v.filter(Boolean).join(" ");
}

/* ── Tanggal ──────────────────────────────────────────────────── */

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const NAMA_BULAN_SINGKAT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI_MINGGU = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** "yyyy-mm-dd" -> Date tengah malam lokal. Sengaja tidak new Date(iso):
    itu di parsing sebagai UTC, jadi di zona waktu negatif tanggalnya
    mundur satu hari.
    Kembalikan undefined (bukan null) supaya langsung cocok dengan
    tipe argumen fungsi pembanding di bawah tanpa perlu dibungkus lagi. */
function dariIso(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function keIso(d: Date): string {
  const bl = String(d.getMonth() + 1).padStart(2, "0");
  const hr = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${bl}-${hr}`;
}

function keBulan(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function awalHari(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function samaHari(a?: Date, b?: Date): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function samaBulan(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function tambahBulan(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sebelum(a: Date, b: Date): boolean {
  return awalHari(a).getTime() < awalHari(b).getTime();
}

/** 42 sel = 6 baris penuh. Jumlah baris yang benar-benar terpakai
    berubah tiap bulan (4 sampai 6), dan grid yang menyusut bikin
    panel kalender "berdenyut" setiap kali bulan berganti. Enam baris
    selalu mantendo tinggi panel tetap. */
function kisiBulan(bulan: Date): Date[] {
  const pertama = new Date(bulan.getFullYear(), bulan.getMonth(), 1);
  const mulai = new Date(pertama);
  mulai.setDate(mulai.getDate() - pertama.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(mulai);
    d.setDate(mulai.getDate() + i);
    return d;
  });
}

/* ── Komponen ─────────────────────────────────────────────────── */

export function Calendar({
  mode = "single",
  nilai,
  onPilih,
  min,
  maks,
  bulanAwal,
  onTutup,
}: {
  mode?: ModeKalender;
  /** single/month: string ISO. range: {dari, sampai}. */
  nilai?: NilaiKalender;
  onPilih: (v: string | RentangKalender | undefined) => void;
  min?: string;
  maks?: string;
  /** Bulan yang ditampilkan saat kalender dibuka (uncontrolled). */
  bulanAwal?: string;
  onTutup?: () => void;
}) {
  const hariIni = useMemo(() => awalHari(new Date()), []);
  const [bulanTampil, setBulanTampil] = useState<Date>(() => {
    /* bulanAwal bisa datang dalam dua bentuk, dan keduanya sah:
         "yyyy-mm-dd"  dari DateFieldID (nilai tanggal lengkap)
         "yyyy-mm"     dari MonthFieldID (nilai bulan, tanpa hari)

       Versi lama selalu menempelkan "-01", jadi bentuk kedua berubah
       jadi "2026-10-01-01" yang tidak cocok dengan pola dariIso dan
       mengembalikan undefined. Efeknya: kalender bulan SELALU membuka
       di bulan berjalan, bukan di bulan yang sedang dipilih, dan bulan
       yang terpilih tidak ikut ter-highlight - terkiniatala perlu
       menggulir mundur setiap kali popup dibuka.

       Sekarang keduanya diterima, dan sama-sama diturunkan ke tanggal
       1. Kalau bentuknya tidak dikenal, tetap jatuh ke bulan berjalan
       - lebih baik daripada kalender kosong. */
    const awal = bulanAwal ? dariIso(bulanAwal) ?? dariIso(`${bulanAwal}-01`) : null;
    return awal ?? hariIni;
  });
  /* Mode bulan HARUS dibuka langsung di kisi 12 bulan, bukan di kisi
     hari. Versi pertama memakai "hari" untuk semua mode, jadi saat
     memilih bulan untuk Laporan Bulanan yang muncul grid tanggal dengan
     SETIAP tanggal bulan itu disorot - satu bulan pilihan berubah jadi
     31 lingkaran teal. Bukan salah hitung, tapi bukan yang
     dimaksud: yang dipilih adalah bulan, bukan satu hari.

     Tampilan "hari" di mode bulan juga tidak bisa dicapai - tombol
     kepala hanya berpindah bulan<->tahun di mode itu. */
  const [tampilan, setTampilan] = useState<"hari" | "bulan" | "tahun">(mode === "month" ? "bulan" : "hari");
  /* Mode SELALU mengunci tampilan ke kisi yang tepat, bukan hanya saat
     pertama kali dibuat.

     Versi lama menulis mode ke useState di awal saja, jadi begitu
     pemanggil mengubah mode dari "single" ke "month" (atau sebaliknya)
     kalender tetap menampilkan kisi yang lama. Di panel cari terlihat
     nyata: sakelar "Tanggal / Bulan" sudah tertekan, tapi yang muncul
     tetap grid hari dan tombol 12 bulan tidak pernah ada.

     useState hanya menjalankan nilainya sekali, jadi penyesuaiannya
     dilakukan saat render - pola "sesuaikan state saat render" yang
     sama dipakai TimeFieldID. */
  const [modeTerakhir, setModeTerakhir] = useState(mode);
  if (mode !== modeTerakhir) {
    setModeTerakhir(mode);
    setTampilan(mode === "month" ? "bulan" : "hari");
  }
  const [jangkarTahun, setJangkarTahun] = useState(() => bulanTampil.getFullYear());

  /* Semua tanggal di bawah diurai dari STRING, lalu DI-MEMO. Bukan
     sekadar dariIso(...) langsung: dariIso membuat objek Date baru
     setiap render, jadi identitasnya selalu berubah dan setiap
     useMemo yang memakainya jadi tidak pernah kena cache, dan lint
     akan menandainya sebagai dependensi yang berubah tiap render.
     Mengunci ke string aslinya membuat identitasnya stabil selama
     nilai yang ditampilkan benar-benar sama. */
  const terpilihSingle = useMemo(
    () => (typeof nilai === "string" && /^\d{4}-\d{2}-\d{2}$/.test(nilai) ? dariIso(nilai) : undefined),
    [nilai]
  );
  const terpilihBulan = typeof nilai === "string" && /^\d{4}-\d{2}$/.test(nilai) ? nilai : "";
  const rentangDari = nilai && typeof nilai === "object" ? nilai.dari : undefined;
  const rentangSampai = nilai && typeof nilai === "object" ? nilai.sampai : undefined;
  const dariRange = useMemo(() => (rentangDari ? dariIso(rentangDari) : undefined), [rentangDari]);
  const sampaiRange = useMemo(() => (rentangSampai ? dariIso(rentangSampai) : undefined), [rentangSampai]);
  const batasMin = useMemo(() => (min ? dariIso(min) : undefined), [min]);
  const batasMaks = useMemo(() => (maks ? dariIso(maks) : undefined), [maks]);

  /* Nabrak batas bulan: panah keyboard bisa melompati beberapa bulan,
     jadi bulan tampil ikut menyesuaikan. */
  function keBulanBerikutnya(d: Date, arah: number) {
    setBulanTampil((lama) => (samaBulan(lama, d) ? tambahBulan(lama, arah) : d));
  }

  /* Fokus yang harus menunggu: saat panah keyboard melewati batas bulan,
     grid bulan yang lama sedang keluar, jadi elemen yang tadi dicari
     bukan lagi elemen yang berisi tanggal tujuan. Tanggalnya dititipkan
     di sini lalu difokuskan setelah grid baru benar-benar terpasang. */
  const gridRef = useRef<HTMLDivElement>(null);
  const fokusTertunda = useRef<Date | null>(null);
  useEffect(() => {
    const t = fokusTertunda.current;
    if (!t) return;
    fokusTertunda.current = null;
    gridRef.current?.querySelector<HTMLElement>(`[data-hari="${keIso(t)}"]`)?.focus();
  }, [bulanTampil]);

  function fokusKe(iso: string) {
    gridRef.current?.querySelector<HTMLElement>(`[data-hari="${iso}"]`)?.focus();
  }

  function mati(d: Date): boolean {
    if (batasMin && sebelum(d, batasMin)) return true;
    if (batasMaks && sebelum(batasMaks, d)) return true;
    return false;
  }

  function pilihHari(d: Date) {
    if (mati(d)) return;
    if (mode === "month") {
      onPilih(keBulan(d));
      onTutup?.();
      return;
    }
    if (mode === "range") {
      const dari = dariRange;
      // Rentang baru dimulai setiap kali titik awal sudah ada DAN titik
      // akhirnya sudah ada. Kalau yang diklik kedua lebih awal dari yang
      // pertama, kedua-duanya ditukar supaya resulting range tetap naik.
      if (!dari || (dari && sampaiRange)) onPilih({ dari: keIso(d) });
      else if (sebelum(d, dari)) onPilih({ dari: keIso(d), sampai: rentangDari });
      else onPilih({ dari: rentangDari, sampai: keIso(d) });
      return;
    }
    onPilih(samaHari(terpilihSingle, d) ? undefined : keIso(d));
    onTutup?.();
  }

  function onKeyboardHari(e: KeyboardEvent<HTMLDivElement>) {
    const el = e.target as HTMLElement;
    const sekarang = dariIso(el.dataset.hari ?? "");
    if (!sekarang) return;

    const geser: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let tujuan: Date | undefined;

    if (e.key in geser) {
      tujuan = new Date(sekarang);
      tujuan.setDate(tujuan.getDate() + geser[e.key]);
    } else if (e.key === "Home" || e.key === "End") {
      tujuan = new Date(sekarang);
      tujuan.setDate(tujuan.getDate() + (e.key === "Home" ? -sekarang.getDay() : 6 - sekarang.getDay()));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      tujuan = tambahBulan(sekarang, e.key === "PageUp" ? -1 : 1);
      // 31 Jan + 1 bulan harus jadi 28/29 Feb, bukan 3 Mar.
      const akhirBulanTujuan = new Date(tujuan.getFullYear(), tujuan.getMonth() + 1, 0).getDate();
      tujuan.setDate(Math.min(sekarang.getDate(), akhirBulanTujuan));
    } else {
      return;
    }

    e.preventDefault();
    if (!samaBulan(tujuan, bulanTampil)) {
      fokusTertunda.current = tujuan;
      keBulanBerikutnya(tujuan, sebelum(tujuan, bulanTampil) ? -1 : 1);
      return;
    }
    fokusKe(keIso(tujuan));
  }

  /* Roving tabindex: hanya satu sel yang bisa di-Tab. Targetnya tanggal
     terpilih kalau ada di bulan ini, kalau tidak hari ini, kalau tidak
     juga tanggal 1. Tanpa ini, Tab akan melewati 42 tombol satu per satu. */
  const selFokus = useMemo(() => {
    if (mode === "single" && terpilihSingle && samaBulan(terpilihSingle, bulanTampil)) return terpilihSingle;
    if (mode === "range" && dariRange && samaBulan(dariRange, bulanTampil)) return dariRange;
    if (samaBulan(hariIni, bulanTampil)) return hariIni;
    return new Date(bulanTampil.getFullYear(), bulanTampil.getMonth(), 1);
  }, [mode, terpilihSingle, dariRange, bulanTampil, hariIni]);

  const kisi = useMemo(() => kisiBulan(bulanTampil), [bulanTampil]);
  const minggu = useMemo(() => {
    const rows: Date[][] = [];
    for (let i = 0; i < kisi.length; i += 7) rows.push(kisi.slice(i, i + 7));
    return rows;
  }, [kisi]);

  const labelBulan = `${NAMA_BULAN[bulanTampil.getMonth()]} ${bulanTampil.getFullYear()}`;

  /* Lebar panel tetap 300px supaya tidak melompat saat bulan dengan 4
     baris berganti ke bulan dengan 6 baris.

     max-w-full, BUKAN max-width berbasis 100vw. Karena popupnya
     diletakkan di dalam wadah yang lebarnya sudah dihitung lebih
     dulu (lihat CalendarPopover), kalender harus menghormati
     lebar wadah itu - inilah yang membuatnya bisa menyusut.

     Dengan max-width berbasis 100vw, kalender tetap 300px walau
     wadahnya cuma 175px, dan popupnya meluber melewati tepi layar.
     Di HP itu terjadi pada dua isian tanggal "Dari" dan "Sampai"
     yang berbagi satu baris. */
  return (
    <div className="pf-cal w-full select-none text-[color:var(--pf-ink)]">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {labelBulan}
      </div>

      {/* Kepala

          Nama bulan dan tahun dipisah oleh GARIS, bukan hanya jarak.
          Versi pertama cuma memberi gap 2px dan keduanya sama tebal,
          jadi keduanya terbaca sebagai satu kata ("Oktodef2026").
          Satu garis tipis di tengah membuatnya jelas dua bagian dari
          satu kendali - dan tiap bagiannya tetap bisa diketuk.

          Panah kiri/kanan di mode bulan melompat SATU TAHUN, bukan satu
          bulan: di kisi 12 bulan yang tampil adalah spawned tahun, jadi
          melompat satu bulan tidak mengubah apa pun yang dilihat. */}
      <div className="mb-2 flex items-center justify-between gap-1">
        <button
          type="button"
          aria-label={mode === "month" ? "Tahun sebelumnya" : "Bulan sebelumnya"}
          onClick={() => setBulanTampil((b) => (mode === "month" ? new Date(b.getFullYear() - 1, b.getMonth(), 1) : tambahBulan(b, -1)))}
          className="pf-cal-btn"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>

        <div className="flex items-center">
          <button
            type="button"
            aria-label="Pilih bulan"
            onClick={() => {
              setJangkarTahun(bulanTampil.getFullYear());
              setTampilan((t) => (t === "bulan" ? "tahun" : "bulan"));
            }}
            className="pf-cal-btn px-2 text-[13px] font-semibold tracking-tight text-[color:var(--pf-ink)]"
          >
            {NAMA_BULAN[bulanTampil.getMonth()]}
          </button>
          <span aria-hidden className="h-4 w-px shrink-0 rounded-full bg-[color:var(--pf-line)]" />
          <button
            type="button"
            aria-label="Pilih tahun"
            onClick={() => {
              setJangkarTahun(bulanTampil.getFullYear());
              setTampilan("tahun");
            }}
            className="pf-cal-btn px-2 text-[13px] font-semibold tabular-nums text-[color:var(--pf-ink)]"
          >
            {bulanTampil.getFullYear()}
          </button>
        </div>

        <button
          type="button"
          aria-label={mode === "month" ? "Tahun berikutnya" : "Bulan berikutnya"}
          onClick={() => setBulanTampil((b) => (mode === "month" ? new Date(b.getFullYear() + 1, b.getMonth(), 1) : tambahBulan(b, 1)))}
          className="pf-cal-btn"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="relative">
        {/* Kisi tanggal HANYA untuk mode tanggal dan rentang. Di mode
            bulan kisi ini tidak dirender sama sekali - bukan karena
            disembunyikan, tapi karena tidak pernah ada gunanya: yang
            dipilih adalah bulan, bukan hari. */}
        {tampilan === "hari" && mode !== "month" ? (
          <>
            <div className="mb-1 grid grid-cols-7">
              {HARI_MINGGU.map((h) => (
                <div key={h} className="flex h-7 items-center justify-center text-[11px] font-semibold text-[color:var(--pf-ink-3)]">
                  {h}
                </div>
              ))}
            </div>

            <div ref={gridRef} role="grid" aria-label={labelBulan} className="grid grid-cols-7" onKeyDown={onKeyboardHari}>
              {minggu.map((baris, i) => (
                <div key={i} role="row" className="contents">
                  {baris.map((d) => {
                    const diLuar = !samaBulan(d, bulanTampil);
                    const iniHariIni = samaHari(d, hariIni);
                    const matiSel = mati(d);
                    const terpilih =
                      mode === "single"
                        ? samaHari(terpilihSingle, d)
                        : mode === "range"
                          ? samaHari(dariRange, d) || samaHari(sampaiRange, d)
                          : keBulan(d) === terpilihBulan;
                    const diTengahRentang =
                      mode === "range" && dariRange && sampaiRange &&
                      setelah(d, dariRange) && sebelum(d, sampaiRange);

                    return (
                      <div key={keIso(d)} role="gridcell" aria-selected={terpilih || undefined} className="relative flex h-9 items-center justify-center">
                        {/* Pita rentang: lebar penuh di antara kedua ujung,
                            setengah di sel ujungnya supaya menyatu dengan
                            lingkaran pilihan tanpa celah. */}
                        {diTengahRentang || (mode === "range" && (samaHari(dariRange, d) || samaHari(sampaiRange, d)) && dariRange && sampaiRange) ? (
                          <div
                            className={cx(
                              "absolute inset-y-1 rounded-full bg-[color:var(--pf-accent-soft)]",
                              samaHari(dariRange, d) ? "left-1/2 right-0" : samaHari(sampaiRange, d) ? "left-0 right-1/2" : "inset-x-0"
                            )}
                          />
                        ) : null}
                        <button
                          type="button"
                          disabled={matiSel}
                          data-hari={keIso(d)}
                          aria-label={d.toDateString()}
                          tabIndex={samaHari(d, selFokus) ? 0 : -1}
                          onClick={() => pilihHari(d)}
                          className={cx(
                            "relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-medium tabular-nums transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pf-accent)]",
                            diLuar ? "text-[color:var(--pf-ink-3)] opacity-45" : "text-[color:var(--pf-ink)]",
                            !terpilih && !matiSel && "hover:bg-[color:var(--pf-surface-2)]",
                            matiSel && !terpilih && "cursor-not-allowed opacity-30",
                            iniHariIni && !terpilih && "ring-1 ring-inset ring-[color:var(--pf-line-strong)]",
                            terpilih && "bg-[color:var(--pf-accent)] font-semibold text-white hover:bg-[color:var(--pf-accent-strong)]"
                          )}
                        >
                          {d.getDate()}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {/* Tinggi tombol bulan/tahun 36px, bukan 40px.

            Alasannya bukan selera: tinggi panel menentukan apakah
            popup muat di bawah field atau tidak. Empat baris tombol
            40px menambah 16px, dan 16px itulah yang membuat popup
            tidak muat lalu naik menutupi header lengket di halaman
            Laporan. 36px masih di atas ukuran yang nyaman untuk
            disentuh jari, dan grid ini bukan satu-satunya cara
            memilih bulan - kepala kalender juga bisa diklik. */}
        {tampilan === "bulan" ? (
          <div className="grid grid-cols-3 gap-1 py-1">
            {NAMA_BULAN.map((nama, i) => {
              const dipilih = mode === "month"
                ? terpilihBulan === `${bulanTampil.getFullYear()}-${String(i + 1).padStart(2, "0")}`
                : i === bulanTampil.getMonth();
              return (
                <button
                  key={nama}
                  type="button"
                  onClick={() => {
                    if (mode === "month") {
                      onPilih(`${bulanTampil.getFullYear()}-${String(i + 1).padStart(2, "0")}`);
                      onTutup?.();
                      return;
                    }
                    setBulanTampil(new Date(bulanTampil.getFullYear(), i, 1));
                    setTampilan("hari");
                  }}
                  className={cx(
                    "h-9 rounded-xl text-[12.5px] font-semibold transition-colors hover:bg-[color:var(--pf-surface-2)]",
                    dipilih ? "bg-[color:var(--pf-accent)] text-white" : "text-[color:var(--pf-ink)]"
                  )}
                >
                  {NAMA_BULAN_SINGKAT[i]}
                </button>
              );
            })}
          </div>
        ) : null}

        {tampilan === "tahun" ? (
          <>
            <div className="mb-1 flex items-center justify-between px-0.5">
              <button type="button" aria-label="12 tahun sebelumnya" onClick={() => setJangkarTahun((y) => y - 12)} className="pf-cal-btn">
                <ChevronLeft size={16} strokeWidth={2} />
              </button>
              <span className="text-[11px] font-semibold text-[color:var(--pf-ink-3)]">
                {jangkarTahun - 5}–{jangkarTahun + 6}
              </span>
              <button type="button" aria-label="12 tahun berikutnya" onClick={() => setJangkarTahun((y) => y + 12)} className="pf-cal-btn">
                <ChevronRight size={16} strokeWidth={2} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 py-1">
              {Array.from({ length: 12 }, (_, i) => jangkarTahun - 5 + i).map((tahun) => (
                <button
                  key={tahun}
                  type="button"
                  onClick={() => {
                    if (mode === "month") {
                      onPilih(`${tahun}-${String(bulanTampil.getMonth() + 1).padStart(2, "0")}`);
                      onTutup?.();
                      return;
                    }
                    setBulanTampil(new Date(tahun, bulanTampil.getMonth(), 1));
                    setTampilan("bulan");
                  }}
                  className={cx(
                    "h-9 rounded-xl text-[13px] font-semibold tabular-nums transition-colors hover:bg-[color:var(--pf-surface-2)]",
                    tahun === bulanTampil.getFullYear() ? "bg-[color:var(--pf-accent)] text-white" : "text-[color:var(--pf-ink)]"
                  )}
                >
                  {tahun}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {mode === "range" ? (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-[color:var(--pf-line-soft)] pt-2">
          <button
            type="button"
            onClick={() => onPilih({ dari: keIso(hariIni), sampai: keIso(hariIni) })}
            className="rounded-lg px-2 py-1 text-[11.5px] font-semibold text-[color:var(--pf-accent)] hover:bg-[color:var(--pf-accent-soft)]"
          >
            Hari ini
          </button>
          <button
            type="button"
            onClick={() => onPilih({})}
            className="rounded-lg px-2 py-1 text-[11.5px] font-semibold text-[color:var(--pf-ink-3)] hover:bg-[color:var(--pf-surface-2)]"
          >
            Hapus
          </button>
        </div>
      ) : null}
    </div>
  );
}

function setelah(a: Date, b: Date): boolean {
  return awalHari(a).getTime() > awalHari(b).getTime();
}

export type { ReactNode };
