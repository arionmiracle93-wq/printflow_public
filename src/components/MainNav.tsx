"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { UserRole } from "@/lib/auth-client";
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

const DESKTOP_LINKS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/pesanan", label: "Pekerjaan", icon: ClipboardList },
  { href: "/pesanan/baru", label: "Order Baru", icon: Plus },
  { href: "/pelanggan", label: "Pelanggan", icon: Users },
  { href: "/mitra", label: "Mitra", icon: Factory },
  { href: "/serah-terima", label: "Shift", icon: Handshake },
];

const MOBILE_LINKS: NavItem[] = [
  { href: "/", label: "Beranda", icon: Gauge },
  { href: "/pesanan", label: "Kerjaan", icon: ClipboardList },
  { href: "/pesanan/baru", label: "Baru", icon: Plus },
  { href: "/serah-terima", label: "Shift", icon: Handshake },
  { href: "/pelanggan", label: "Pelanggan", icon: Users },
];

/** Link yang tetap tampil saat layar tablet menengah (nav dikecilkan ke ikon). */
const MEDIUM_HREFS = ["/", "/pesanan", "/pesanan/baru", "/serah-terima", "/pelanggan", "/pengaturan"];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/pesanan") return pathname === "/pesanan" || /^\/pesanan\/\d+$/.test(pathname);
  return pathname.startsWith(href);
}

function CountBadge({ count, floating = false }: { count: number; floating?: boolean }) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      aria-label={`${count} serah terima menunggu`}
      className={`${
        floating ? "absolute -right-1 -top-1" : "ml-0.5"
      } inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 py-0.5 text-[9px] font-black leading-none text-white shadow-[0_2px_7px_rgba(244,63,94,.38)] ring-2 ring-white/20`}
    >
      {label}
    </span>
  );
}

function NavLink({
  item,
  pathname,
  iconOnly = false,
  pendingCount = 0,
  onIntent,
}: {
  item: NavItem;
  pathname: string;
  /** Tablet: label disembunyikan, ikon saja, nama menu lewat tooltip + aria-label. */
  iconOnly?: boolean;
  pendingCount?: number;
  onIntent?: (href: string) => void;
}) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  const shiftCount = item.href === "/serah-terima" ? pendingCount : 0;
  const isCreate = item.href === "/pesanan/baru";

  return (
    <Link
      href={item.href}
      prefetch
      onMouseEnter={() => onIntent?.(item.href)}
      onFocus={() => onIntent?.(item.href)}
      onTouchStart={() => onIntent?.(item.href)}
      title={item.label}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={`relative inline-flex items-center gap-1.5 rounded-xl font-bold transition-all duration-200 ${
        iconOnly ? "px-2.5 py-2 text-xs" : "px-3 py-2 text-[13px]"
      } ${
        active
          ? "bg-white text-[#07384f] shadow-[0_6px_18px_-8px_rgba(2,26,36,.75)]"
          : isCreate
            ? "bg-amber-400/95 text-[#07384f] shadow-[0_6px_18px_-8px_rgba(251,191,36,.7)] hover:bg-amber-300"
            : "text-cyan-50/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon size={15} strokeWidth={active ? 2.7 : 2.1} />
      {!iconOnly ? item.label : null}
      {!iconOnly && active ? (
        <span
          aria-hidden="true"
          className="absolute -bottom-[7px] left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full bg-teal-500/90"
        />
      ) : null}
      <CountBadge count={shiftCount} />
    </Link>
  );
}

export function MainNav({ role = "owner" }: { role?: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => setMounted(true), []);

  const prefetch = (href: string) => {
    if (href !== pathname) router.prefetch(href);
  };

  // Persiapkan menu utama saat browser idle. Data hasil mutasi tetap segar karena
  // semua form memanggil router.refresh() setelah menyimpan.
  useEffect(() => {
    const common = ["/", "/pesanan", "/pesanan/baru", "/serah-terima", "/mitra", "/pelanggan"];
    const run = () =>
      common.filter((href) => href !== pathname).forEach((href) => router.prefetch(href));
    const idleWindow = window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(run, { timeout: 2_000 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(run, 700);
    return () => window.clearTimeout(id);
  }, [pathname, router]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const res = await fetch("/api/handovers/pending-count", { cache: "no-store" });
        const json = (await res.json()) as { ok?: boolean; count?: number };
        if (active && json.ok) setPendingCount(Math.max(0, Number(json.count) || 0));
      } catch {
        // Navigasi tidak boleh rusak hanya karena badge gagal dimuat.
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    const onFocus = () => void refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("handover-count-changed", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("handover-count-changed", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname]);

  // Role Karyawan menggabungkan akses lapangan Operator dan Kasir.
  const allowed = (_item: NavItem) => true;

  return (
    <>
      {/* Desktop luas (xl+): ikon + nama menu */}
      <nav
        aria-label="Navigasi utama"
        className="hidden items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.07] p-1 xl:flex"
      >
        {DESKTOP_LINKS.filter(allowed).map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            pendingCount={pendingCount}
            onIntent={prefetch}
          />
        ))}
      </nav>

      {/* Tablet: ikon saja supaya tidak berdesakan */}
      <nav aria-label="Navigasi utama" className="hidden items-center gap-0.5 md:flex xl:hidden">
        {DESKTOP_LINKS.filter(allowed)
          .filter((l) => MEDIUM_HREFS.includes(l.href))
          .map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              iconOnly
              pendingCount={pendingCount}
              onIntent={prefetch}
            />
          ))}
      </nav>

      {/* HP: menu utama dikunci di bawah layar, dirender lewat Portal agar
          tidak ikut "menempel" ke header yang memakai backdrop-filter. */}
      {mounted
        ? createPortal(
            <nav
              aria-label="Navigasi bawah"
              className="mobile-bottom-nav border-t border-teal-100/80 bg-white/97 shadow-[0_-10px_34px_-14px_rgba(8,47,73,.4)] backdrop-blur-xl no-print dark:border-teal-900/40 dark:bg-[#0b1c28]/97 dark:shadow-[0_-10px_34px_-14px_rgba(0,0,0,.7)]"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(13,148,136,.4),transparent)]"
              />
              <ul className="mx-auto grid max-w-lg grid-cols-5 px-1">
                {MOBILE_LINKS.filter(allowed).map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  const primary = item.href === "/pesanan/baru";
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        prefetch
                        onTouchStart={() => prefetch(item.href)}
                        aria-current={active ? "page" : undefined}
                        className={`relative flex flex-col items-center gap-1 px-1 pb-2 pt-1.5 text-[10px] font-bold transition-colors ${
                          active ? "text-teal-700 dark:text-teal-300" : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute inset-x-4 top-0 h-[3px] rounded-full transition-all duration-300 ${
                            active ? "bg-[linear-gradient(90deg,#0d9488,#fbbf24)] opacity-100" : "opacity-0"
                          }`}
                        />
                        <span
                          className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition ${
                            primary
                              ? "-mt-4 h-11 w-11 border-[3px] border-white bg-[linear-gradient(150deg,#fcd34d,#f59e0b)] text-[#07384f] shadow-[0_10px_22px_-8px_rgba(245,158,11,.85)]"
                              : active
                                ? "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300"
                                : ""
                          }`}
                        >
                          <Icon size={primary ? 21 : 19} strokeWidth={primary ? 2.6 : 2.3} />
                          {item.href === "/serah-terima" ? <CountBadge count={pendingCount} floating /> : null}
                        </span>
                        {item.label}
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
