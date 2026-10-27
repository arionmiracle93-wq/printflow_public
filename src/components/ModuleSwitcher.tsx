"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * SWITCHER MODUL DI HEADER
 * =========================================================================
 * Dua segmen: Produksi | Invoice. Muncul di dalam modul dan di
 * halaman bersama, hanya kalau pengguna berizin membuka keduanya.
 *
 * Di home switcher disembunyikan karena home itu sendiri sudah pemilih
 * modul - menampilkannya di sana hanya mengulang tombol yang ada di
 * bawah. Di halaman bersama, segmen yang aktif mengikuti cookie modul
 * terakhir (D-03). Cookie itu hanya untuk menyorot navigasi; tidak
 * pernah dipakai untuk redirect.
 *
 * Kenapa disembunyikan untuk karyawan tanpa izin Invoice: satu segmen
 * yang bisa diklik bukan switcher, cuma tombol - dan menampilkan
 * Invoice di sini membuat orang mengira modul itu bisa dibuka. Di
 * home, sebaliknya, kartu terkunci tetap ditampilkan supaya fitur
 * ketahuan ada dan owner bisa menyalakan izinnya.
 *
 * Di layar kecil switcher ini tidak dipaksakan masuk header karena
 * ruangnya sempit. Dua modul tetap bisa dipilih dari menu tiga titik
 * (MoreMenu), khusus untuk layar kecil.
 *
 * Rute di bawah "/pesanan", "/mitra", dan "/serah-terima" TIDAK
 * dipindahkan. Rute itu sengaja tetap di tempatnya supaya URL push
 * notification yang sudah terkirim ke HP operator tidak jadi rusak
 * (lihat folder src/app/api/orders).
 */
const MODULE_COOKIE = "print-flow-module";

function simpanModul(kunci: "produksi" | "invoice") {
  document.cookie = `${MODULE_COOKIE}=${kunci}; path=/; max-age=31536000; samesite=lax`;
}

const MODUL = [
  {
    kunci: "produksi",
    nama: "Produksi",
    href: "/produksi",
    /** Route yang dianggap "di dalam modul Produksi". */
    awalan: ["/produksi", "/pesanan", "/mitra", "/serah-terima"],
    aktif: "bg-teal-700 text-white dark:bg-teal-500",
  },
  {
    kunci: "invoice",
    nama: "Invoice",
    href: "/invoice",
    awalan: ["/invoice", "/pengaturan/invoice"],
    aktif: "bg-amber-400 text-black",
  },
] as const;

export function ModuleSwitcher({
  bisaInvoice,
  modulTerakhir,
}: {
  bisaInvoice: boolean;
  modulTerakhir: "produksi" | "invoice" | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const here = MODUL.find((m) => m.awalan.some((a) => pathname === a || pathname.startsWith(`${a}/`)));
  const kunciDiHalamanIni = here?.kunci ?? null;
  // Di halaman bersama tidak ada modul yang sedang dibuka. Yang
  // disorot adalah modul terakhir yang dikunjungi - hanya penanda,
  // bukan tujuan redirect.
  const aktif = kunciDiHalamanIni ?? modulTerakhir;

  /* Saat pengguna benar-benar berada di dalam modul, simpan pilihan
     itu untuk dipakai di halaman bersama berikutnya. Efek ini tidak
     pernah mengubah URL atau mengarahkan pengguna. */
  useEffect(() => {
    if (!kunciDiHalamanIni) return;
    simpanModul(kunciDiHalamanIni);
  }, [kunciDiHalamanIni]);

  // Tanpa izin Invoice, tidak ada yang perlu ditukar: hanya ada satu modul.
  if (!bisaInvoice) return null;

  // Home sudah menjadi pemilih modul; switcher di sini hanya akan
  // mengulang kartu yang ada di bawah.
  if (pathname === "/") return null;

  return (
    <nav
      aria-label="Pindah modul"
      className="hidden shrink-0 items-center gap-0.5 rounded-xl bg-[color:var(--pf-surface-3)] p-0.5 ring-1 ring-[color:var(--pf-line)] md:flex"
    >
      {MODUL.map((m) => {
        const dipilih = aktif === m.kunci;
        return (
          <Link
            key={m.kunci}
            href={m.href}
            prefetch={false}
            aria-current={dipilih ? "page" : undefined}
            onClick={() => simpanModul(m.kunci)}
            onMouseEnter={() => router.prefetch(m.href)}
            onTouchStart={() => router.prefetch(m.href)}
            className={`rounded-[10px] px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
              dipilih ? m.aktif : "text-[color:var(--pf-ink-2)] hover:bg-[color:var(--pf-accent-soft)] hover:text-[color:var(--pf-ink)]"
            }`}
          >
            {m.nama}
          </Link>
        );
      })}
    </nav>
  );
}
