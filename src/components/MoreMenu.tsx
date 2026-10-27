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
  LayoutGrid,
  MoreVertical,
  ReceiptText,
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
  /** Hanya tampil di layar kecil; disembunyikan dari md ke atas. */
  mobileOnly?: boolean;
  roles: UserRole[];
  /** Butuh izin modul Invoice. */
  requiresInvoice?: boolean;
  /** Tautan modul, bukan menu utilitas. */
  isModule?: boolean;
};

const ITEMS: MoreItem[] = [
  /* "Beranda" ada untuk semua akun dan semua ukuran layar, karena
     "/" adalah home screen pemilih modul dan tidak ada satu pun tombol
     lain yang mengarah ke sana.

     Di layar lebar, jalur ke home sudah ada lewat logo di header. Di
     layar kecil logo itu DIHIDDENkan (lihat layout.tsx: kelasnya
     "hidden md:flex"), jadi tanpa entri ini pengguna HP tidak punya
     jalan kembali ke beranda sama sekali. Itu sebabnya entri ini tidak
     diberi mobileOnly - dipakai semua orang, bukan cuma di HP. */
  {
    href: "/",
    label: "Beranda",
    description: "Pilih modul Produksi atau Invoice",
    icon: LayoutGrid,
    roles: ["owner", "karyawan"],
  },
  /* Dua modul juga tersedia di menu ini KHUSUS layar kecil. Di layar
     lebar, switcher modul di header sudah cukup. Di HP switcher itu
     tidak dipaksakan masuk header karena ruangnya sempit - akibatnya
     dulu dari Invoice ke Produksi harus mampir ke Beranda dulu.
     Sekarang perpindahan modul tetap satu menu, tanpa kehilangan
     tombol Beranda yang sudah ada. */
  {
    href: "/produksi",
    label: "Produksi",
    description: "Dashboard, antrean, dan tahapan pekerjaan",
    icon: Factory,
    mobileOnly: true,
    roles: ["owner", "karyawan"],
    isModule: true,
  },
  {
    href: "/invoice",
    label: "Invoice",
    description: "Tagihan, pembayaran, dan laporan",
    icon: ReceiptText,
    mobileOnly: true,
    roles: ["owner", "karyawan"],
    requiresInvoice: true,
    isModule: true,
  },
  /* Shift sudah pindah ke bottom navigation mobile (MainNav), jadi
     tidak lagi didaftarkan di menu tiga titik. */
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
  /* Satu pintu untuk SEMUA pengaturan - diminta owner. Dulu ada dua
     tempat: /pengaturan di sini (logo, push, backup, kondisi sistem)
     dan /invoice/pengaturan di dalam modul invoice (kop, rekening,
     aturan dokumen). Dua pintu untuk satu urusan membuat orang
     menyimpannya di tempat berbeda, jadi saat mau mengubah rekening
     selalu ada satu yang tidak ditemukan.

     Sekarang /pengaturan menjadi satu-satunya pintu, dengan tab
     "Produksi" dan "Invoice" di dalamnya. Keterangan di bawah
     menyebutkan keduanya supaya jelas apa saja yang ada di dalam. */
  {
    href: "/pengaturan",
    label: "Pengaturan",
    description: "Produksi & Invoice: identitas, rekening, sistem",
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

type MoreMenuProps = { role: UserRole; bisaInvoice: boolean };

export function MoreMenu({ role, bisaInvoice }: MoreMenuProps) {
  const pathname = usePathname();
  return (
    <MoreMenuForPath
      key={pathname}
      pathname={pathname}
      role={role}
      bisaInvoice={bisaInvoice}
    />
  );
}

function MoreMenuForPath({
  role,
  bisaInvoice,
  pathname,
}: MoreMenuProps & { pathname: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const allowedItems = ITEMS.filter(
    (item) => item.roles.includes(role) && (!item.requiresInvoice || bisaInvoice),
  );
  // Tautan modul tidak membuat tombol "Menu lainnya" menyala seperti
  // halaman utilitas. Di modul, penanda aktif sudah ada di switcher.
  const isUtilityPage = allowedItems.some(
    (item) => !item.isModule && (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );

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
            ? "border-amber-300 bg-amber-400 text-black shadow-[0_5px_16px_rgba(251,191,36,.24)]"
            : "border-[color:var(--pf-line)] bg-[color:var(--pf-surface-2)] text-[color:var(--pf-ink)] hover:border-[color:var(--pf-accent-line)] hover:bg-[color:var(--pf-accent-soft)]"
        }`}
      >
        <MoreVertical size={20} strokeWidth={2.4} />
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-[80] max-h-[calc(100dvh-5.5rem)] w-[min(19rem,calc(100vw-1rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_20px_55px_rgba(7,56,79,.3)] md:top-11">
          <div className="border-b border-slate-100 px-2.5 pb-2 pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">
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
                  prefetch={false}
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
                    <span className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold">{item.label}</span>
                    </span>
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
