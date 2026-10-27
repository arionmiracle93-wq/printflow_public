"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { BarChart3, History, Package, Plus, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { MobileDrawer } from "@/components/MobileDrawer";
import { useMounted } from "@/components/useMounted";

type InvoiceNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  primary?: boolean;
};

/**
 * NAVIGASI BAWAH MODUL INVOICE (mobile/tablet).
 * ===================================================================
 * Menggantikan deretan tab yang dulu menempel di atas judul halaman.
 * Susunannya mengikuti bottom navigation Produksi:
 *
 *   [Menu/Status] [Riwayat] [Baru] [Katalog] [Laporan]
 *
 * "Baru" selalu di slot ketiga - tepat di tengah dari lima item - dan
 * dibuat menonjol dengan ikon +. "Pengaturan" tidak ikut karena sudah
 * tersedia di menu tiga titik header (MoreMenu).
 *
 * Slot pertama adalah drawer tiga garis. Isinya tetap milik halaman:
 * filter status + Export CSV di daftar Invoice, atau aksi dokumen di
 * halaman detail. Halaman tanpa aksi (mis. Katalog) tidak menampilkan
 * slot ini, jadi jumlah kolom menyesuaikan.
 *
 * Dirender lewat portal seperti MainNav supaya posisi fixed-nya tidak
 * salah acuan di Chrome Android yang punya backdrop-filter di header.
 */
export function InvoiceBottomNav({
  isOwner,
  newHref,
  actions,
  menuLabel = "Menu",
}: {
  isOwner: boolean;
  /** Tujuan tombol tengah; sudah membawa ?m= sesuai mode dokumen. */
  newHref: string;
  /** Isi drawer tiga garis; kalau kosong, slot pertama tidak dirender. */
  actions?: ReactNode;
  /** "Status" di daftar Invoice, "Menu" di halaman dokumen. */
  menuLabel?: string;
}) {
  const pathname = usePathname();
  const mounted = useMounted();

  const links: InvoiceNavItem[] = [
    {
      href: "/invoice",
      label: "Riwayat",
      icon: History,
      // Detail dokumen (/invoice/123) masih bagian dari Riwayat.
      active: pathname === "/invoice" || /^\/invoice\/\d+(\/|$)/.test(pathname),
    },
    {
      href: newHref,
      label: "Baru",
      icon: Plus,
      active: pathname === "/invoice/baru",
      primary: true,
    },
    {
      href: "/invoice/katalog",
      label: "Katalog",
      icon: Package,
      active: pathname === "/invoice/katalog" || pathname.startsWith("/invoice/katalog/"),
    },
    ...(isOwner
      ? [
          {
            href: "/invoice/laporan",
            label: "Laporan",
            icon: BarChart3,
            active: pathname === "/invoice/laporan" || pathname.startsWith("/invoice/laporan/"),
          },
        ]
      : []),
  ];

  if (!mounted) return null;

  const columns = links.length + (actions ? 1 : 0);

  return createPortal(
    <nav
      className="mobile-bottom-nav border-t border-teal-100 bg-white/95 shadow-[0_-8px_30px_rgba(8,47,73,.12)] backdrop-blur-xl lg:hidden no-print dark:border-teal-900/40 dark:bg-[#0b1c28]/95 dark:shadow-[0_-8px_30px_rgba(0,0,0,.4)]"
      aria-label="Navigasi Invoice"
    >
      <ul
        className="mx-auto grid max-w-lg px-1 pb-[env(safe-area-inset-bottom)]"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {actions ? (
          <li>
            {/* key pathname menutup drawer otomatis saat pindah halaman. */}
            <MobileDrawer key={pathname} variant="bottom" label={menuLabel}>
              {actions}
            </MobileDrawer>
          </li>
        ) : null}

        {links.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch={false}
                aria-current={item.active ? "page" : undefined}
                aria-label={item.label}
                className={`relative flex flex-col items-center gap-1 px-1 py-2 text-[10px] font-bold ${
                  item.active
                    ? "text-teal-700 dark:text-teal-300"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                <span
                  className={`relative flex h-8 w-8 items-center justify-center rounded-xl transition ${
                    item.primary
                      ? "-mt-4 h-11 w-11 bg-amber-400 text-[color:var(--pf-ink)]"
                      : item.active
                        ? "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300"
                        : ""
                  }`}
                >
                  <Icon size={item.primary ? 22 : 19} strokeWidth={2.3} />
                </span>
                {item.primary ? null : item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>,
    document.body,
  );
}
