"use client";

/**
 * TOMBOL YANG MEMBUKA PANEL PENCARIAN DARI HALAMAN SERVER
 *
 * Kenapa komponen ini ada, dan bukan `onClick` langsung di halaman:
 *
 * src/app/invoice/page.tsx adalah Server Component. Server Component
 * tidak boleh mengirim event handler - fungsi tidak bisa dilewatkan
 * lewat RSC payload. Kalau dipaksakan, React gagal saat serialize dan
 * seluruh halaman Error ("An error occurred in the Server Components
 * render"), padahal `next build` tetap lolos tanpa peringatan apa pun.
 *
 * Yang membuat bug ini sulit terlihat: halamannya hanya gagal kalau
 * cabang yang memuat tombol itu ikut dirender. Tombol ini muncul
 * bersamaan dengan kartu ringkasan filter tanggal, jadi /invoice
 * tanpa filter berjalan normal - yang meledak hanya /invoice?bulan=
 * atau /invoice?dari=&sampai=. Persis pada "kalau diklik Lihat
 * semua baru error".
 *
 * Perbaikannya bukan memindahkan seluruh halaman jadi Client
 * Component (halaman ini butuh server untuk membaca database), tapi
 * memotong bagian yang benar-benar interaktif saja ke sini. Isinya
 * tetap satu baris: kirim CustomEvent, dan QuickSearch yang mendengar.
 */
export function TombolBukaPencarian({
  detail,
  children,
  className = "btn-secondary min-h-11 px-3",
}: {
  /** Isi detail yang diteruskan ke event printflow:buka-pencarian. */
  detail: { bulan?: string; dari?: string; sampai?: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        window.dispatchEvent(new CustomEvent("printflow:buka-pencarian", { detail }))
      }
    >
      {children}
    </button>
  );
}