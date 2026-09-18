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
      className={`${floating ? "absolute -right-1 -top-1" : "ml-0.5"} inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 py-0.5 text-[9px] font-black leading-none text-white shadow-[0_2px_7px_rgba(244,63,94,.38)] ring-2 ring-white/20`}
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
      prefetch
      onMouseEnter={() => onIntent?.(item.href)}
      onFocus={() => onIntent?.(item.href)}
      onTouchStart={() => onIntent?.(item.href)}
      className={`group relative inline-flex items-center gap-1.5 rounded-[var(--r-md)] font-semibold tracking-tight transition-all duration-200 ${
        compact ? "px-2.5 py-2 text-xs" : "px-3 py-2 text-[13px]"
      } ${
        active
          ? "bg-gradient-to-b from-teal-400/95 to-teal-500 text-white shadow-[0_1px_0_rgba(255,255,255,.25)_inset,0_6px_18px_rgba(20,184,166,.32)]"
          : "text-cyan-50/75 hover:bg-white/[0.12] hover:text-white"
      }`}
    >
      <Icon size={15} strokeWidth={active ? 2.6 : 2} />
      {item.label}
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
    const run = () => common.filter((href) => href !== pathname).forEach((href) => router.prefetch(href));
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
      <nav className="hidden items-center gap-0.5 xl:flex">
        {DESKTOP_LINKS.filter(allowed).map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} compact pendingCount={pendingCount} onIntent={prefetch} />
        ))}
      </nav>

      <nav className="hidden items-center gap-0.5 md:flex xl:hidden">
        {DESKTOP_LINKS.filter(allowed).filter((l) => ["/", "/pesanan", "/pesanan/baru", "/serah-terima", "/pelanggan", "/pengaturan"].includes(l.href)).map(
          (item) => <NavLink key={item.href} item={item} pathname={pathname} compact pendingCount={pendingCount} onIntent={prefetch} />,
        )}
      </nav>

      {mounted
        ? createPortal(
            <nav className="mobile-bottom-nav border-t border-slate-200/70 bg-white/92 shadow-[0_-10px_34px_rgba(8,47,73,.14)] backdrop-blur-2xl md:hidden no-print dark:border-white/[0.07] dark:bg-[#0a1a25]/92 dark:shadow-[0_-10px_34px_rgba(0,0,0,.5)]">
              <ul className="mx-auto grid max-w-lg grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
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
                        className={`relative flex flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[10px] font-bold tracking-tight transition-colors ${
                          active ? "text-teal-700 dark:text-teal-300" : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        {/* Penanda tab aktif: garis kecil menempel di tepi atas bar. */}
                        {active && !primary ? (
                          <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-gradient-to-r from-teal-400 to-cyan-400" />
                        ) : null}
                        <span
                          className={`relative flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] transition-all duration-200 ${
                            primary
                              ? "-mt-5 h-12 w-12 rounded-[1.1rem] bg-gradient-to-b from-amber-300 to-amber-400 text-[#3b2604] ring-4 ring-white/90 shadow-[0_10px_24px_rgba(251,191,36,.45)] dark:ring-[#0a1a25]/90"
                              : active
                                ? "scale-105 bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300"
                                : ""
                          }`}
                        >
                          <Icon size={primary ? 23 : 19} strokeWidth={2.3} />
                          {item.href === "/serah-terima" ? (
                            <CountBadge count={pendingCount} floating />
                          ) : null}
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
