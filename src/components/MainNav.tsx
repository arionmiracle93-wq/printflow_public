"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMounted } from "@/components/useMounted";
import { usePendingHandoverCount } from "@/components/usePendingHandoverCount";
import { createPortal } from "react-dom";
import {
  ClipboardList,
  Factory,
  Gauge,
  Handshake,
  Plus,
  Users,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };

/* Rute dashboard produksi adalah "/produksi", bukan "/".
   "/" sekarang home screen pemilih modul (lihat src/app/page.tsx),
   jadi tautan berlabel "Dashboard" tidak boleh mengarah ke sana. */
const DESKTOP_LINKS: NavItem[] = [
  { href: "/produksi", label: "Dashboard", icon: Gauge },
  { href: "/pesanan", label: "Pekerjaan", icon: ClipboardList },
  { href: "/pesanan/baru", label: "Order Baru", icon: Plus },
  { href: "/pelanggan", label: "Pelanggan", icon: Users },
  { href: "/mitra", label: "Mitra", icon: Factory },
  { href: "/serah-terima", label: "Shift", icon: Handshake },
];

/* TAB INVOICE SUDAH DICABUT dari menu ini.
   Alasannya, bukan sekadar soal gaya: sebelum ada home screen, Invoice
  cuma satu tab di antara tab lain, sehingga kelihatan seperti fitur
   tambahan Produksi. Sekarang Invoice adalah modul yang setara, dan
   modul sejati tidak masuk lewat tab di dalam modul lain - ia masuk
   lewat home screen dan switcher header (src/components/ModuleSwitcher.tsx).

   Modul Invoice juga sudah punya navigasinya sendiri: InvoiceSidebar. */

/**
 * NAVIGASI BAWAH DI LAYAR KECIL (5 slot).
 *
 * Invoice dicabut dari sini juga, dengan alasan yang sama seperti di
 * menu atas: ia bukan lagi tab di dalam Produksi. Shift sekarang
 * ikut di sini supaya menu penting sehari-hari tidak perlu dibuka
 * lewat menu tiga titik. Pada lebar md sampai xl Shift tetap muncul
 * di bar atas, jadi tidak ada duplikasi di layar lebar.
 *
 * Slot pertama adalah dashboard Produksi. Ke home di layar kecil
 * bukan lewat sini, melainkan lewat "Beranda" di menu tiga titik -
 * karena logo header disembunyikan di bawah md (lihat layout.tsx),
 * sehingga di HP logo itu tidak ada sama sekali.
 *
 * Urutannya mengikuti aliran kerja: Dashboard, Kerjaan, Baru,
 * Pelanggan, Shift. Tombol "Baru" berada di slot ketiga - tepat di
 * tengah dari lima item - dan tetap menonjol ke atas.
 */
const MOBILE_LINKS: NavItem[] = [
  { href: "/produksi", label: "Dashboard", icon: Gauge },
  { href: "/pesanan", label: "Kerjaan", icon: ClipboardList },
  { href: "/pesanan/baru", label: "Baru", icon: Plus },
  { href: "/pelanggan", label: "Pelanggan", icon: Users },
  { href: "/serah-terima", label: "Shift", icon: Handshake },
];

function isActive(pathname: string, href: string) {
  if (href === "/produksi") return pathname === "/produksi";
  if (href === "/pesanan") return pathname === "/pesanan" || /^\/pesanan\/\d+$/.test(pathname);
  return pathname.startsWith(href);
}

function CountBadge({ count, floating = false }: { count: number; floating?: boolean }) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      aria-label={`${count} serah terima menunggu`}
      className={`${floating ? "absolute -right-1 -top-1" : "ml-0.5"} inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 py-0.5 text-[9px] font-bold leading-none text-white shadow-[0_2px_7px_rgba(244,63,94,.38)] ring-2 ring-white/20`}
    >
      {label}
    </span>
  );
}

function NavLink({
  item,
  pathname,
  compact = false,
  pendingCount = 0,
  onIntent,
}: {
  item: NavItem;
  pathname: string;
  compact?: boolean;
  pendingCount?: number;
  onIntent?: (href: string) => void;
}) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  const shiftCount = item.href === "/serah-terima" ? pendingCount : 0;
  return (
    <Link
      href={item.href}
      prefetch={false}
      onMouseEnter={() => onIntent?.(item.href)}
      onFocus={() => onIntent?.(item.href)}
      onTouchStart={() => onIntent?.(item.href)}
      className={`inline-flex items-center gap-1.5 rounded-xl font-semibold transition-all ${
        compact ? "px-2.5 py-2 text-xs" : "px-3 py-2 text-[13px]"
      } ${
        active
          ? "bg-teal-700 text-white shadow-[0_5px_18px_rgba(13,148,136,.22)] dark:bg-teal-500 dark:shadow-[0_5px_18px_rgba(20,184,166,.25)]"
          : "text-[color:var(--pf-ink-2)] hover:bg-[color:var(--pf-accent-soft)] hover:text-[color:var(--pf-ink)]"
      }`}
    >
      <Icon size={15} strokeWidth={active ? 2.5 : 2} />
      {item.label}
      <CountBadge count={shiftCount} />
    </Link>
  );
}

export function MainNav() {
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useMounted();

  const prefetch = (href: string) => {
    if (href !== pathname) router.prefetch(href);
  };

  /* DULUNYA: semua menu utama di-pramuat sekaligus saat browser idle
     (common.forEach -> router.prefetch), dan efek ini mengulang setiap
     kali pathname berubah.

     Artinya SETIAP perpindahan halaman menembakkan 7 permintaan ke
     server sekaligus. Di tab Network masing-masing memakan 300ms
     sampai 2,3 detik, dan semuanya berebut koneksi yang sama dengan
     navigasi yang benar-benar sedang ditunggu pengguna. Hasilnya:
     perpindahan yang ditunggu ikut melambat karena halaman lain yang
     tidak sedang dibuka.

     Tidak ada pramuat otomatis lagi. Halaman baru diambil setelah
     pengguna menunjukkan niat - lewat onMouseEnter, onFocus, atau
     onTouchStart di bawah. Menyia-nyiakan bandwidth untuk halaman yang
     mungkin tidak pernah dibuka ternyata lebih mahal daripada jeda
     singkat pada perpindahan yang memang sedang ditunggu. */

  /* Angka serah terima menunggu diambil dari modul bersama, bukan dari
     useEffect milik komponen ini. Badge yang sama dipakai untuk Shift di
     bar atas dan di bottom nav mobile. Modul.usePendingHandoverCount
     memakai satu timer, bukan polling terpisah per posisi menu. */
  const pendingCount = usePendingHandoverCount();

  /* NAVIGASI INI MILIK MODUL PRODUKSI, BUKAN NAVIGASI APLIKASI.
     -----------------------------------------------------------------
     Sebelumnya komponen ini dirender untuk semua halaman, sehingga di
     dalam Invoice orang masih melihat Dashboard, Pekerjaan, Order Baru,
     dan bottom nav Produksi. Itu yang membuat Invoice terasa seperti
     submenu Produksi, walaupun home screen sudah punya dua kartu setara.

     Aturannya sekarang:
     - Home ("/") netral: tidak ada nav modul, hanya kartu pemilih.
     - Invoice punya InvoiceSidebar sendiri; bottom nav Produksi tidak
       boleh ikut tampil di sana.
     - Halaman bersama tetap memakai nav ini karena menu seperti
       Pelanggan, Shift, dan Pengaturan dipakai bersama.
     - /tidak-diizinkan adalah halaman masalah, bukan tempat kerja. */
  const diHalamanNetral = pathname === "/" || pathname === "/tidak-diizinkan";
  const diModulInvoice =
    pathname === "/invoice" ||
    pathname.startsWith("/invoice/") ||
    pathname.startsWith("/pengaturan/invoice");
  if (diHalamanNetral || diModulInvoice) return null;

  /* Tidak ada lagi penyaringan izin di sini.

     Dulu menu ini memuat /invoice dan harus disembunyikan dari
     karyawan yang saklarnya mati. Sekarang Invoice sudah dicabut dari
     menu ini, dan semua sisa menunya (Dashboard, Pekerjaan, Order
     Baru, Pelanggan, Mitra, Shift) tidak butuh izin - seluruh akun
     yang login punya akses ke semuanya.

     Izin Invoice tidak hilang dari halaman: modulnya tetap dijaga
     oleh getInvoiceAccess() di server, dan di header oleh
     ModuleSwitcher. Yang hilang hanya penyaringannya yang ada di sini. */

  return (
    <>
      <nav className="hidden items-center gap-0.5 xl:flex">
        {DESKTOP_LINKS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} compact pendingCount={pendingCount} onIntent={prefetch} />
        ))}
      </nav>

      <nav className="hidden items-center gap-0.5 md:flex xl:hidden">
        {DESKTOP_LINKS.filter((l) => ["/produksi", "/pesanan", "/pesanan/baru", "/serah-terima", "/pelanggan", "/pengaturan"].includes(l.href)).map(
          (item) => <NavLink key={item.href} item={item} pathname={pathname} compact pendingCount={pendingCount} onIntent={prefetch} />,
        )}
      </nav>

      {mounted
        ? createPortal(
            <nav className="mobile-bottom-nav border-t border-teal-100 bg-white/95 shadow-[0_-8px_30px_rgba(8,47,73,.12)] backdrop-blur-xl md:hidden no-print dark:border-teal-900/40 dark:bg-[#0b1c28]/95 dark:shadow-[0_-8px_30px_rgba(0,0,0,.4)]">
              <ul
                /* Lima menu, jadi lima kolom. Invoice dicabut dari
                   navigasi bawah; Shift masuk supaya menu harian tidak
                   perlu dibuka lewat menu tiga titik. Tombol "Baru"
                   tetap di kolom ketiga, tepat di tengah. */
                className="mx-auto grid max-w-lg grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]"
              >
                {MOBILE_LINKS.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  const primary = item.href === "/pesanan/baru";
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        prefetch={false}
                        onTouchStart={() => prefetch(item.href)}
                        aria-label={item.label}
                        className={`relative flex flex-col items-center gap-1 px-1 py-2 text-[10px] font-bold ${
                          active ? "text-teal-700 dark:text-teal-300" : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        <span
                          className={`relative flex h-8 w-8 items-center justify-center rounded-xl transition ${
                            primary
                              ? "-mt-4 h-11 w-11 bg-amber-400 text-[color:var(--pf-ink)]"
                              : active
                                ? "bg-teal-50 text-teal-700"
                                : ""
                          }`}
                        >
                          <Icon size={primary ? 22 : 19} strokeWidth={2.3} />
                          {item.href === "/serah-terima" ? (
                            <CountBadge count={pendingCount} floating />
                          ) : null}
                        </span>
                        {primary ? null : item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>,
            document.body,
          )
        : null}
    </>
  );
}
