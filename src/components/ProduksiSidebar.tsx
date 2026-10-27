"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  ClipboardList,
  Factory,
  Gauge,
  Handshake,
  Plus,
  Settings2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { CountBadge } from "@/components/MainNav";
import { usePendingHandoverCount } from "@/components/usePendingHandoverCount";

type NavItem = { href: string; label: string; icon: LucideIcon };

/**
 * SIDEBAR KIRI MODUL PRODUKSI (desktop lg ke atas).
 * ===================================================================
 * Permintaan owner: menu pill di bar atas modul Produksi (Dashboard,
 * Pekerjaan, Order Baru, Pelanggan, Mitra, Shift) dipindah jadi kolom
 * samping, contoh gaya seperti kebiasaan InvoiceSidebar. Konsekuensinya:
 *
 * - Hanya tampil di layar lebar (lg+). Di layar sempit hingga lg,
 *   navigasi tetap lewat bottom nav MainNav (yang di halaman berframe
 *   ini diperluas sampai lg) - persis pola modul Invoice.
 * - Identitas (logo + nama usaha) TIDAK digandakan ke sini; itu tetap
 *   milik bar atas, jadi tidak ada dua logo dalam satu layar.
 * - Pramuat obe pra-jaringan: tautan TIDAK di-prefetch otomatis
 *   (router.prefetch hanya setelah pengguna menunjukkan niat - ikut
 *   pola MainNav PrefetchLink agar koneksi tidak berlomba-lomba).
 * - Badge Shift memakai modul yang sama (usePendingHandoverCount),
 *   jadi tidak ada timer polling baru.
 * ===================================================================
 * Cara KEMBALI ke tampilan lama (menu pill di bar atas):
 *   git revert commit konversi ini, atau set konstanta
 *   PAKAI_SIDEBAR_PRODUKSI = false di MainNav.tsx.
 */
const NAV_LINKS: NavItem[] = [
  { href: "/produksi", label: "Dashboard", icon: Gauge },
  { href: "/pesanan", label: "Pekerjaan", icon: ClipboardList },
  { href: "/pesanan/baru", label: "Order Baru", icon: Plus },
  { href: "/pelanggan", label: "Pelanggan", icon: Users },
  { href: "/mitra", label: "Mitra", icon: Factory },
  { href: "/serah-terima", label: "Shift", icon: Handshake },
];

/** Logika aktif sama seperti MainNav: detail (/pesanan/123) ikut "Pekerjaan". */
function isActive(pathname: string, href: string) {
  if (href === "/produksi") return pathname === "/produksi";
  if (href === "/pesanan") return pathname === "/pesanan" || /^\/pesanan\/\d+(\/|$)/.test(pathname);
  return pathname.startsWith(href);
}

function SideRow({
  item,
  pathname,
  pendingCount,
  onIntent,
}: {
  item: NavItem;
  pathname: string;
  pendingCount: number;
  onIntent: (href: string) => void;
}) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  const shiftCount = item.href === "/serah-terima" ? pendingCount : 0;
  return (
    <Link
      href={item.href}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      onMouseEnter={() => onIntent(item.href)}
      onFocus={() => onIntent(item.href)}
      onTouchStart={() => onIntent(item.href)}
      className={`ppi-side-btn ${active ? "active" : ""}`}
    >
      <span className="ppi-ico">
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <span className="ppi-side-label">{item.label}</span>
      <CountBadge count={shiftCount} />
    </Link>
  );
}

export function ProduksiSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const pendingCount = usePendingHandoverCount();

  const prefetch = (href: string) => {
    if (href !== pathname) router.prefetch(href);
  };

  return (
    <aside className="ppi-side ppi-side--produksi pf-side-scroll sticky top-20 hidden w-full flex-col self-start lg:flex">
      <span className="ppi-kicker">Modul Produksi</span>
      {/* Ilustrasi dekoratif: dipasang lewat CSS background (bukan <img>)
          supaya hanya versi yang sesuai mode (terang/gelap) yang diunduh
          browser, dan tidak perlu dibacakan screen reader. Gambarnya
          diatur di .ppi-side-hero (globals.css). */}
      <div className="ppi-side-hero" aria-hidden />
      <nav aria-label="Menu Produksi" className="ppi-side-nav">
        {NAV_LINKS.map((item) => (
          <SideRow key={item.href} item={item} pathname={pathname} pendingCount={pendingCount} onIntent={prefetch} />
        ))}
      </nav>
      <hr className="ppi-side-hr" />
      <nav className="ppi-side-nav">
        <Link
          href="/pengaturan"
          prefetch={false}
          aria-current={pathname === "/pengaturan" ? "page" : undefined}
          className={`ppi-side-btn ${pathname === "/pengaturan" ? "active" : ""}`}
        >
          <span className="ppi-ico">
            <Settings2 size={18} strokeWidth={1.75} />
          </span>
          <span className="ppi-side-label">Pengaturan</span>
        </Link>
      </nav>
    </aside>
  );
}

/**
 * Pembungkus dua kolom halaman Produksi (sidebar kiri + isi). Pola sama
 * dengan InvoiceFrame: sidebar jadi kolom sendiri di lg+, isi mengecil
 * dengan rapi. Di bawah lg frame ini menjadi transparan - kolomnya
 * digabung (contents) - sehingga halaman tampil satu kolom seperti
 * sebelumnya, dan navigasi tetap di bottom nav.
 */
export function ProduksiFrame({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-5">
      <div className="contents lg:block">
        <ProduksiSidebar />
      </div>
      <div className="min-w-0">
        {children}
        {/* Bottom nav MainNav tampil sampai lg di halaman yang berframe;
            spacer ini mencegah konten terakhir tertutup bar navigasi. */}
        <div className="hidden h-20 md:block lg:hidden no-print" aria-hidden />
      </div>
    </div>
  );
}
