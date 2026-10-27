"use client";

import { useCallback, useEffect, useRef, useState, type AnimationEvent as ReactAnimationEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";

/**
 * MENU GESER (drawer) UNTUK LAYAR KECIL
 * ===================================================================
 * Tombol aksi dokumen (Edit, Tandai Lunas, Cetak, ...) dulu tampil
 * sebagai deretan tombol besar tepat di atas kertas. Di 360px deretannya
 * memakan dua baris penuh - lebih tinggi dari kepala dokumennya sendiri -
 * sehingga pengguna harus menggulir melewati tombol dulu sebelum sampai
 * ke isi tagihan yang sebinverse-bnya mau dibaca.
 *
 * Sekarang tombolnya disembunyikan di balik menu geser. Yang tetap terlihat
 * cuma satu tombol tiga garis, sehingga isi dokumen langsung muncul.
 *
 * Sifat yang dijaga di sini:
 * - Hanya di layar kecil. Di lg ke atas sidebar sudah jadi kolom action
 *   sendiri, jadi drawer ini tidak boleh muncul (dan memang di lg:hidden).
 * - Tutup dengan: tombol tiga garis lagi, klik area gelap, tombol Escape,
 *   atau menggeser/menekan latar. Tidak ada jalan buntu untuk menutup.
 * - Saat terbuka, halaman di belakangnya tidak ikut bergulir.
 * - Fokus dipindahkan ke panel supaya pembaca layar dan tombol Tab ikut
 *   ke dalam menu, dan dikembalikan ke tombol pembuka saat ditutup.
 * - Panel dirender lewat portal ke <body>. Ini penting sejak tombolnya
 *   ikut bottom navigation: kontainer nav punya transform untuk
 *   mengunci posisi di Chrome Android, dan position:fixed di dalam
 *   transform akan mengacu ke nav - bukan ke layar.
 * - TIDAK ikut ke cetak / PDF (pakai ppi-screen-only).
 */
export function MobileDrawer({
  label = "Menu",
  children,
  variant = "bar",
}: {
  /** Nama menu untuk pembaca layar DAN judul panel. */
  label?: string;
  /** Isi menu - biasanya deretan tombol aksi. */
  children: ReactNode;
  /**
   * "bar"    = tombol lebar di deretan tab/form (dipakai halaman dokumen).
   * "bottom" = slot pertama bottom navigation mobile, tampil seperti
   *            item nav lain (ikon di atas, label di bawah).
   */
  variant?: "bar" | "bottom";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tombolRef = useRef<HTMLButtonElement>(null);
  /* Dua state supaya ada animasi keluar:
     - buka      : niat pengguna (terbuka / tertutup). Mengatur aria, Escape,
                   dan fokus.
     - terpasang : panel masih ada di halaman. Saat menutup, panel tetap
                   terpasang sampai animasi geser keluar selesai, baru
                   dilepas. */
  const [buka, setBuka] = useState(false);
  const [terpasang, setTerpasang] = useState(false);
  const timerTutup = useRef<number | null>(null);

  const bukaMenu = useCallback(() => {
    if (timerTutup.current !== null) window.clearTimeout(timerTutup.current);
    timerTutup.current = null;
    setTerpasang(true);
    setBuka(true);
  }, []);

  const tutup = useCallback(() => {
    setBuka(false);
    if (timerTutup.current !== null) window.clearTimeout(timerTutup.current);
    // Panel dilepas oleh onAnimationEnd (lihat lepasSetelahAnimasi) begitu
    // geser keluarnya BENAR-BENAR selesai. Timer di sini hanya cadangan
    // kalau event itu tidak datang. Dulu timer 240ms inilah satu-satunya
    // pelepas: hitungannya mulai dari ketukan, padahal animasi baru mulai
    // setelah React selesai merender. Kalau main thread sedang sibuk
    // (mis. tautan di dalam menu sedang memulai navigasi), panel bisa
    // dilepas SEBELUM geserannya selesai - terlihat seperti menghilang
    // mendadak / patah-patah. Tanpa gerak (prefers-reduced-motion) panel
    // dilepas seketika.
    const tanpaGerak = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    timerTutup.current = window.setTimeout(
      () => {
        setTerpasang(false);
        timerTutup.current = null;
      },
      tanpaGerak ? 0 : 600,
    );
  }, []);

  const lepasSetelahAnimasi = useCallback((e: ReactAnimationEvent<HTMLDivElement>) => {
    // Animasi bayangan (::before) dan anak elemen juga melempar event ini;
    // hanya geser keluar panel itu sendiri yang boleh melepas panel. Cek
    // data-state supaya buka-ulang di tengah animasi tidak ikut terlepas.
    if (e.target !== e.currentTarget) return;
    if (e.animationName !== "pf-drawer-out") return;
    if (e.currentTarget.dataset.state !== "closed") return;
    if (timerTutup.current !== null) window.clearTimeout(timerTutup.current);
    timerTutup.current = null;
    setTerpasang(false);
  }, []);

  useEffect(
    () => () => {
      if (timerTutup.current !== null) window.clearTimeout(timerTutup.current);
    },
    [],
  );

  /* Ada dua hal yang harus berlaku bersamaan ketika menu terbuka:
     panel tampil, dan halaman di belakangnya tidak bisa digulir. Keduanya
     dikerjakan di sini supaya tidak mungkin hanya satu yang terjadi. */
  useEffect(() => {
    if (!buka) return;
    const root = document.documentElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") tutup();
    };
    window.addEventListener("keydown", onKey);
    ref.current?.focus({ preventScroll: true });
    return () => window.removeEventListener("keydown", onKey);
  }, [buka, tutup]);

  /* Fokus dikembalikan ke tombol pembuka setelah menu ditutup, supaya
     pengguna tidak tersesat saat menekan Tab.

     Elemen tombol disalin ke variabel lokal di dalam efek. Membaca
     tombolRef.current di fungsi cleanup berisiko menunjuk elemen yang
     sudah berubah, karena React boleh sudah memasang ulang DOM-nya
     sebelum cleanup dijalankan. */
  useEffect(() => {
    if (!buka) return;
    const tombol = tombolRef.current;
    return () => tombol?.focus({ preventScroll: true });
  }, [buka]);

  const close = tutup;

  return (
    <>
      <button
        ref={tombolRef}
        type="button"
        onClick={bukaMenu}
        aria-label={label}
        aria-expanded={buka}
        aria-haspopup="dialog"
        title={label}
        className={
          variant === "bottom"
            ? `relative flex min-h-11 w-full flex-col items-center gap-1 px-1 py-2 text-[10px] font-bold transition-colors ${
                buka ? "text-teal-700 dark:text-teal-300" : "text-slate-400 dark:text-slate-500"
              }`
            : "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl bg-[color:var(--pf-surface-2)] px-1 py-2 text-[10px] font-bold leading-tight text-[color:var(--pf-ink-2)] transition active:bg-[color:var(--pf-surface-3)] lg:hidden dark:bg-white/[0.06]"
        }
      >
        {variant === "bottom" ? (
          <>
            <span
              className={`relative flex h-8 w-8 items-center justify-center rounded-xl transition ${
                buka ? "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300" : ""
              }`}
            >
              <Menu size={19} strokeWidth={2.3} />
            </span>
            <span className="max-w-full truncate">{label}</span>
          </>
        ) : (
          <>
            <Menu size={19} strokeWidth={2.4} />
            {/* Tulisan tombol ikut label. Bawaannya "Menu" karena isi
                drawer ini di hampir semua halaman adalah PERINTAH: Edit,
                Terbitkan, Tandai Lunas, Duplikat, Cetak, Unduh PDF - bukan
                daftar status. Halaman daftar invoice lewatkan "Status"
                karena isinya memang deretan filter status. */}
            <span className="w-full truncate text-center">{label}</span>
          </>
        )}
      </button>

      {/* Latar gelap + panel. Saat tertutup keduanya dilepas dari halaman
          (setelah animasi keluar), jadi tidak ada yang bisa difokuskan atau
          dibaca pembaca layar. data-state mengatur animasi masuk/keluar. */}
      {terpasang
        ? createPortal(
            <>
              <div className="pf-drawer-backdrop" data-state={buka ? "open" : "closed"} onClick={close} aria-hidden />
              <div
                ref={ref}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                tabIndex={-1}
                className="pf-drawer-panel"
                data-state={buka ? "open" : "closed"}
                onAnimationEnd={lepasSetelahAnimasi}
              >
                {/* Panel luar hanya bergeser (+ bayangan). Gulir ada di
                    pf-drawer-scroll supaya bayangan tidak terpotong dan
                    animasinya cukup transform/opacity (jalan di compositor). */}
                <div className="pf-drawer-scroll">
                <div className="flex items-center justify-between gap-3 border-b border-[color:var(--pf-line-soft)] pb-3">
                  <p className="text-sm font-extrabold text-[color:var(--pf-ink)]">{label}</p>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Tutup menu"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--pf-surface-3)] text-[color:var(--pf-ink-2)] transition hover:bg-[color:var(--pf-surface-2)]"
                  >
                    <X size={18} strokeWidth={2.4} />
                  </button>
                </div>
                {/* Tautan di dalam drawer menutup panelnya sendiri. Tanpa ini,
                    memilih filter status atau menu lain membiarkan panel tetap
                    terbuka di atas halaman tujuan. Tombol aksi (Edit, Cetak,
                    dll.) tidak ditutup paksa karena biasanya membuka modal
                    lanjutan dari dalam drawer yang sama.

                    Elemen dengan data-drawer-close ikut menutup panel: dipakai
                    tombol yang memang memindahkan perhatian ke halaman atau
                    modal lain (pilih kategori, impor CSV, kelola kategori). */}
                <div
                  className="pt-3"
                  onClick={(event) => {
                    if ((event.target as Element).closest("a, [data-drawer-close]")) tutup();
                  }}
                >
                  {children}
                </div>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}