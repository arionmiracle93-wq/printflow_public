"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BarChart3, FilePlus2, History, Package, ReceiptText, Settings } from "lucide-react";
import { SidebarThemeButton } from "@/components/ThemeToggle";
import { Select } from "@/components/Select";
import { AccentLastWord } from "@/components/AccentLastWord";
import { DOC_MODES, DOC_TYPES, docModeOf, type DocType } from "@/lib/invoice-modes";

/**
 * SIDEBAR MODUL INVOICE
 * Panel kiri berisi: identitas usaha, pemilih MODE DOKUMEN, tombol
 * aksi halaman ini, menu navigasi, dan catatan sistem.
 *
 * Catatan desain: sidebar TIDAK pernah punya max-height atau overflow.
 * Isinya boleh bertambah dan kartunya ikut memanjang, sesuai gambar
 * acuan. Kalau kontennya melebihi tinggi layar, halaman yang digulir -
 * bukan sidebar-nya.
 *
 * modeBehavior:
 *   "filter"  -> memilih mode = menyaring daftar (/invoice?m=...)
 *   "switch"  -> memilih mode = mengganti jenis dokumen baru (callback onSwitchMode)
 *   "fixed"   -> jenis dokumen tidak bisa diubah (dokumen yang sudah ada)
 */
export function InvoiceSidebar({
  businessName,
  isOwner,
  docType,
  modeBehavior,
  onSwitchMode,
  actions,
}: {
  businessName: string;
  isOwner: boolean;
  docType: DocType | "semua";
  modeBehavior: "filter" | "switch" | "fixed";
  onSwitchMode?: (next: DocType) => void;
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [logoFailed, setLogoFailed] = useState(false);
  const current = docType === "semua" ? DOC_MODES.invoice : docModeOf(docType);

  function onModeChange(value: string) {
    if (modeBehavior === "switch" && onSwitchMode) onSwitchMode(value as DocType);
    else if (modeBehavior === "filter") router.push(value === "semua" ? "/invoice" : `/invoice?m=${value}`);
  }

  const newHref = `/invoice/baru${docType !== "semua" && docType !== "invoice" ? `?m=${docType}` : ""}`;
  const select = (
    <div className="relative">
      <ReceiptText size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--ppi-side-ico-ink)]" />
      {/* Select (bukan <select> bawaan) supaya panel pilihannya ikut tema
          dan chevron-nya cuma satu. */}
      <Select
        value={docType}
        disabled={modeBehavior === "fixed"}
        onChange={(e) => onModeChange(e.target.value)}
        className="ppi-side-select !pl-8"
        aria-label="Mode dokumen"
      >
        {modeBehavior === "filter" ? <option value="semua">Semua dokumen</option> : null}
        {DOC_TYPES.map((t) => (
          <option key={t} value={t}>
            {DOC_MODES[t].label}
          </option>
        ))}
      </Select>
    </div>
  );

  const links = [
    { href: "/invoice", label: "Riwayat Dokumen", icon: History, active: pathname === "/invoice" },
    { href: newHref, label: current.newBtn, icon: FilePlus2, active: pathname === "/invoice/baru" },
    { href: "/invoice/katalog", label: "Katalog Produk", icon: Package, active: pathname === "/invoice/katalog" },
    ...(isOwner ? [{ href: "/invoice/laporan", label: "Laporan Bulanan", icon: BarChart3, active: pathname === "/invoice/laporan" }] : []),
  ];

  return (
    <>
      {/* ======= Layar lebar ======= */}
      <aside className="ppi-side sticky top-20 hidden w-full flex-col self-start p-4 lg:flex">
        <div className="ppi-side-brand">
          {logoFailed ? (
            <span className="ppi-side-logo text-[color:var(--ppi-accent)]">
              <ReceiptText size={22} />
            </span>
          ) : (
            <span className="ppi-side-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/api/branding/logo"
                alt=""
                className="h-full w-full object-contain p-1"
                onError={() => setLogoFailed(true)}
                ref={(el) => {
                  // Gambar bisa gagal sebelum React sempat memasang onError (saat halaman baru dimuat).
                  if (el && el.complete && el.naturalWidth === 0) setLogoFailed(true);
                }}
              />
            </span>
          )}
          <div className="min-w-0">
            <p className="ppi-side-name">
              <AccentLastWord text={businessName} />
            </p>
            <span className="ppi-side-tag">Dokumen Elektronik</span>
          </div>
        </div>

        <hr className="ppi-side-hr my-4" />

        <div className="ppi-side-mode">
          <span className="ppi-kicker">Mode Dokumen</span>
          <div className="mt-2">{select}</div>
          <p className="ppi-side-hint">
            {modeBehavior === "fixed" ? "Jenis dokumen tidak bisa diubah setelah dibuat." : current.hint}
          </p>
        </div>

        {actions ? <div className="mt-3 space-y-0.5">{actions}</div> : null}

        <hr className="ppi-side-hr my-4" />

        <nav className="space-y-0.5">
          {links.map((l) => (
            <SideButtonLink key={l.label} href={l.href} label={l.label} icon={<l.icon size={15} />} active={l.active} />
          ))}
          {isOwner ? (
            <SideButtonLink href="/invoice/pengaturan" label="Pengaturan" icon={<Settings size={15} />} active={pathname === "/invoice/pengaturan"} />
          ) : null}
        </nav>

        <div className="mt-5 space-y-1.5">
          <p className="ppi-side-status">Draft editor tersimpan otomatis di perangkat</p>
          <p className="ppi-side-status">
            <span className="ppi-side-dot" aria-hidden />
            Nomor dokumen keluar otomatis saat terbit
          </p>
        </div>

        <div className="ppi-side-mode mt-5">
          <span className="ppi-kicker">Tampilan</span>
          <SidebarThemeButton className="mt-2" />
        </div>
      </aside>

      {/* ======= HP / layar sempit ======= */}
      <nav className="flex items-center gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Menu dokumen">
        <div className="w-44 shrink-0">{select}</div>
        {links.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            className={`chip shrink-0 gap-1 px-3 py-2 text-xs font-bold ${
              l.active ? "border-teal-500 bg-teal-500 text-white" : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            <l.icon size={13} /> {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

/** Nama usaha di kop: gaya "Pamulang Printing" (kata terakhir beraksen). */
function SideButtonLink({ href, label, icon, active }: { href: string; label: string; icon: ReactNode; active?: boolean }) {
  return (
    <Link href={href} className={`ppi-side-btn ${active ? "active" : ""}`}>
      <span className="ppi-ico">{icon}</span>
      {label}
    </Link>
  );
}

/** Pembungkus 2 kolom (sidebar + isi). */
export function InvoiceFrame({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-5">
      <div className="contents lg:block">{sidebar}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Tombol menu di sidebar (dipakai halaman untuk slot "actions"). */
export function SideButton({
  icon,
  children,
  onClick,
  href,
  danger,
  disabled,
  title,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  const cls = `ppi-side-btn ${danger ? "danger" : ""}`;
  const inner = (
    <>
      <span className="ppi-ico">{icon}</span>
      {children}
    </>
  );
  if (href && !disabled) return <Link href={href} className={cls}>{inner}</Link>;
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled} title={title}>
      {inner}
    </button>
  );
}
