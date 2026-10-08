"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BarChart3, FilePlus2, History, ReceiptText, Settings } from "lucide-react";
import { DOC_MODES, DOC_TYPES, docModeOf, type DocType } from "@/lib/invoice-modes";

/**
 * SIDEBAR MODUL INVOICE (meniru app lama)
 *  - Layar lebar: panel kiri berisi logo, MODE DOKUMEN, tombol aksi, dan menu.
 *  - Layar sempit/HP: baris ringkas di atas (mode + 3 tombol), aksi ada di tempat lain.
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
    <select
      value={docType}
      disabled={modeBehavior === "fixed"}
      onChange={(e) => onModeChange(e.target.value)}
      className="w-full rounded-xl border border-teal-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 disabled:opacity-70"
      aria-label="Mode dokumen"
    >
      {modeBehavior === "filter" ? <option value="semua">Semua dokumen</option> : null}
      {DOC_TYPES.map((t) => (
        <option key={t} value={t}>
          {DOC_MODES[t].label}
        </option>
      ))}
    </select>
  );

  const links = [
    { href: "/invoice", label: "Riwayat", icon: History, active: pathname === "/invoice" },
    { href: newHref, label: current.newBtn, icon: FilePlus2, active: pathname === "/invoice/baru" },
    ...(isOwner ? [{ href: "/invoice/laporan", label: "Laporan", icon: BarChart3, active: pathname === "/invoice/laporan" }] : []),
    ...(isOwner ? [{ href: "/invoice/pengaturan", label: "Pengaturan", icon: Settings, active: pathname === "/invoice/pengaturan" }] : []),
  ];

  return (
    <>
      {/* ======= Layar lebar ======= */}
      <aside className="card sticky top-20 hidden max-h-[calc(100vh-6rem)] w-full flex-col gap-3 self-start overflow-y-auto p-3 lg:flex">
        <div className="flex items-center gap-2.5 px-1 pt-1">
          {logoFailed ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white"><ReceiptText size={20} /></span>
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
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
            <p className="truncate text-sm font-extrabold text-[color:var(--pf-ink)]">{businessName}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Dokumen usaha</p>
          </div>
        </div>

        <div className="rounded-2xl border border-teal-200/70 bg-teal-50/60 p-2.5 dark:border-teal-500/20 dark:bg-teal-500/5">
          <span className="mb-1 block text-[9.5px] font-extrabold uppercase tracking-wider text-teal-700">Mode dokumen</span>
          {select}
          <span className="mt-1 block text-[10px] font-semibold leading-snug text-slate-500">
            {modeBehavior === "fixed" ? "Jenis dokumen tidak bisa diubah setelah dibuat." : current.hint}
          </span>
        </div>

        {actions ? <div className="space-y-0.5">{actions}</div> : null}

        <nav className="space-y-0.5 border-t border-slate-200/70 pt-2 dark:border-slate-700/60">
          {links.map((l) => (
            <Link key={l.label} href={l.href} className={`ppi-side-btn ${l.active ? "active" : ""}`}>
              <span className="ppi-ico"><l.icon size={15} /></span>
              {l.label}
            </Link>
          ))}
        </nav>
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

/** Pembungkus 2 kolom (sidebar + isi). */
export function InvoiceFrame({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-5">
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
