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
  Sparkles,
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

/** Grup dipakai hanya untuk memberi judul di dalam dropdown. */
const GROUPS: { title: string; items: MoreItem[] }[] = [
  {
    title: "Harian",
    items: [
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
    ],
  },
  {
    title: "Sistem & pemilik",
    items: [
      {
        href: "/pengaturan",
        label: "Pengaturan",
        description: "Logo, notifikasi, backup & sistem",
        icon: Settings,
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
        href: "/status",
        label: "Status Sistem",
        description: "Diagnosis database dan koneksi",
        icon: Stethoscope,
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
        href: "/revisi-ui",
        label: "Berkas Revisi UI",
        description: "Ringkasan perubahan tampilan + unduh berkas",
        icon: Sparkles,
        roles: ["owner", "karyawan"],
      },
      {
        href: "/panduan",
        label: "Panduan",
        description: "Petunjuk penggunaan dan deployment",
        icon: BookOpen,
        roles: ["owner"],
      },
    ],
  },
];

const ALL_ITEMS: MoreItem[] = GROUPS.flatMap((group) => group.items);

export function MoreMenu({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const allowed = (item: MoreItem) => item.roles.includes(role);
  const allowedItems = ALL_ITEMS.filter(allowed);
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
        aria-haspopup="menu"
        aria-label="Buka menu lainnya"
        aria-expanded={open}
        title="Menu lainnya"
        className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all md:h-9 md:w-9 ${
          open || isUtilityPage
            ? "border-amber-300 bg-amber-400 text-[#07384f] shadow-[0_6px_18px_-8px_rgba(251,191,36,.85)]"
            : "border-white/15 bg-white/10 text-white hover:bg-white/[0.18]"
        }`}
      >
        <MoreVertical size={19} strokeWidth={2.6} />
      </button>

      {open ? (
        <div
          role="menu"
          className="pop-in absolute right-0 top-[calc(100%+.5rem)] z-[85] max-h-[calc(100dvh-5.5rem)] w-[min(19.5rem,calc(100vw-1rem))] overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-2 shadow-[var(--shadow-pop)] md:top-[calc(100%+.4rem)] dark:border-white/10 dark:bg-[#0f202c]"
        >
          {GROUPS.map((group) => {
            const items = group.items.filter(allowed);
            if (items.length === 0) return null;
            return (
              <section key={group.title} className="mb-1 last:mb-0">
                <p className="px-2.5 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-400">
                  {group.title}
                </p>
                <nav className="space-y-0.5">
                  {items.map((item) => {
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
                        className={`${
                          item.mobileOnly ? "flex md:hidden" : "flex"
                        } items-center gap-3 rounded-xl px-2 py-2 transition ${
                          active
                            ? "bg-teal-50 text-teal-800 dark:bg-teal-500/12 dark:text-teal-200"
                            : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.06]"
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                            active
                              ? "bg-[linear-gradient(150deg,#0d9488,#0f766e)] text-white shadow-[0_6px_16px_-8px_rgba(13,148,136,.9)]"
                              : "bg-slate-100 text-slate-500 dark:bg-white/[0.07] dark:text-slate-300"
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
                        {active ? <Check size={15} className="shrink-0 text-teal-600 dark:text-teal-300" /> : null}
                      </Link>
                    );
                  })}
                </nav>
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export { ALL_ITEMS as MORE_MENU_ITEMS };
