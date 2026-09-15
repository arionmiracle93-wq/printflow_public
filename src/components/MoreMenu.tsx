"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BellRing,
  BookOpen,
  Check,
  Factory,
  FileClock,
  History,
  MoreVertical,
  Settings,
  Smartphone,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/lib/auth-client";

type MoreItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  mobileOnly?: boolean;
  roles: UserRole[];
};

const ITEMS: MoreItem[] = [
  {
    href: "/mitra",
    label: "Produksi Mitra",
    description: "Pekerjaan di vendor atau percetakan pusat",
    icon: Factory,
    mobileOnly: true,
    roles: ["owner", "karyawan"],
  },
  {
    href: "/notifikasi",
    label: "Notifikasi Perangkat",
    description: "Aktifkan dan uji push pada HP ini",
    icon: BellRing,
    roles: ["owner", "karyawan"],
  },
  {
    href: "/pengaturan",
    label: "Pengaturan",
    description: "Logo, notifikasi, backup & sistem",
    icon: Settings,
    roles: ["owner"],
  },
  {
    href: "/catatan-perubahan",
    label: "Catatan Perubahan",
    description: "Dokumentasi setiap update aplikasi",
    icon: FileClock,
    roles: ["owner"],
  },
  {
    href: "/status",
    label: "Status Sistem",
    description: "Diagnosis database dan koneksi",
    icon: Stethoscope,
    roles: ["owner"],
  },
  {
    href: "/audit",
    label: "Audit Aktivitas",
    description: "Riwayat login, status, mutasi & foto per akun",
    icon: History,
    roles: ["owner"],
  },
  {
    href: "/sesi",
    label: "Perangkat Aktif",
    description: "Lihat & logout paksa perangkat yang login",
    icon: Smartphone,
    roles: ["owner"],
  },
  {
    href: "/panduan",
    label: "Panduan",
    description: "Petunjuk penggunaan dan deployment",
    icon: BookOpen,
    roles: ["owner"],
  },
];

export function MoreMenu({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const allowedItems = ITEMS.filter((item) => item.roles.includes(role));
  const isUtilityPage = allowedItems.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent | TouchEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("touchstart", closeOutside);
    window.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("touchstart", closeOutside);
      window.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  if (allowedItems.length === 0) return null;

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Buka menu lainnya"
        aria-expanded={open}
        title="Menu lainnya"
        className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all md:h-9 md:w-9 ${
          open || isUtilityPage
            ? "border-amber-300 bg-amber-400 text-[#07384f] shadow-[0_5px_16px_rgba(251,191,36,.24)]"
            : "border-white/15 bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        <MoreVertical size={20} strokeWidth={2.4} />
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-[80] max-h-[calc(100dvh-5.5rem)] w-[min(19rem,calc(100vw-1rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_20px_55px_rgba(7,56,79,.3)] md:top-11">
          <div className="border-b border-slate-100 px-2.5 pb-2 pt-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-400">
              Menu lainnya
            </p>
          </div>
          <nav className="mt-1 space-y-0.5">
            {allowedItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  onMouseEnter={() => router.prefetch(item.href)}
                  onTouchStart={() => router.prefetch(item.href)}
                  onClick={() => setOpen(false)}
                  className={`${item.mobileOnly ? "flex md:hidden" : "flex"} items-center gap-3 rounded-xl px-2.5 py-2.5 transition ${
                    active ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      active ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-extrabold">{item.label}</span>
                    <span className="mt-0.5 block text-[10px] leading-tight text-slate-400">
                      {item.description}
                    </span>
                  </span>
                  {active ? <Check size={15} className="shrink-0 text-teal-600" /> : null}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
