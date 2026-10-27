"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { BarChart3, FilePlus2, History, Package, ReceiptText, Settings } from "lucide-react";
import { SidebarThemeButton } from "@/components/ThemeToggle";
import { InvoiceBottomNav } from "@/components/InvoiceBottomNav";
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
  actionsPosition = "afterLeading",
  menuLabel,
  hideModeOnMobile = false,
}: {
  businessName: string;
  isOwner: boolean;
  docType: DocType | "semua";
  modeBehavior: "filter" | "switch" | "fixed";
  onSwitchMode?: (next: DocType) => void;
  actions?: ReactNode;
  /**
   * Posisi slot `actions` di layar lebar (lg ke atas):
   *   "afterLeading" (bawa-an) -> di bawah dua menu teratas (Invoice Baru,
   *      Riwayat Dokumen). Dipakai tombol aksi draft di editor
   *      (Simpan Draft, Terbitkan, dan seterusnya).
   *   "top" -> paling atas, langsung di bawah kartu Mode Dokumen, di atas
   *      menu navigasi. Dipakai halaman Riwayat supaya Filter Status
   *      tetap berdiri pertama.
   */
  actionsPosition?: "afterLeading" | "top";
  /**
   * Tulisan slot tiga garis di bottom navigation dan judul panelnya.
   *
   * Bawaannya "Menu", yang benar untuk hampir semua halaman: isinya
   * perintah (Edit, Terbitkan, Cetak, Unduh PDF). Halaman daftar
   * invoice lewat "Status" karena isinya memang deretan filter status -
   * owner minta yang begitu karena dua isi itu beda jenis dan
   * menuliskan keduanya dengan satu kata akan menyesatkan.
   */
  menuLabel?: string;
  /**
   * Sembunyikan pemilih Mode Dokumen di HP/layar sempit. Dipakai halaman
   * yang tidak berurusan dengan jenis dokumen (mis. Katalog Produk), supaya
   * tidak ada dropdown "Semua dokumen" yang tidak nyambung di atas halaman.
   * Di layar lebar sidebar tidak berubah.
   */
  hideModeOnMobile?: boolean;
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

  // "Invoice Baru" + "Riwayat Dokumen" selalu berdiri paling atas laman
  // Mode Dokumen, di atas slot tombol aksi draft (Simpan Draft, Terbitkan,
  // dst.). Menu lain menyusul di bawahnya mengikuti urutan lama.
  const leadingLinks = [
    { href: newHref, label: current.newBtn, icon: FilePlus2, active: pathname === "/invoice/baru" },
    { href: "/invoice", label: "Riwayat Dokumen", icon: History, active: pathname === "/invoice" },
  ];

  const trailingLinks = [
    { href: "/invoice/katalog", label: "Katalog Produk", icon: Package, active: pathname === "/invoice/katalog" },
    ...(isOwner ? [{ href: "/invoice/laporan", label: "Laporan Bulanan", icon: BarChart3, active: pathname === "/invoice/laporan" }] : []),
  ];

  return (
    <>
      {/* ======= Layar lebar =======

          GULIR TERPISAH. Sidebar punya wadahnya sendiri:
          - max-h + overflow-y-auto : isinya boleh lebih tinggi dari layar
            tanpa membuat halaman ikut memanjang.
          - overscroll-contain : kalau mouse wheel diarahkan ke sidebar,
            yang bergulir HANYA sidebar. Saat isinya sudah habis di atas
            atau bawah, gulir TIDAK diteruskan ke halaman - jadi kertas
            invoice diam, persis seperti yang diminta. Sebaliknya, wheel
            di atas kertas tidak pernah menyentuh sidebar karena sidebar
            lengket (sticky).

          Catatan: tanpa overscroll-contain, roda mouse di atas sidebar yang
          isinya lebih pendek dari layar sama sekali tidak melakukan
          apa-apa, dan orang mengira layarnya rusak. contain yang
          membuatnya diam dengan sengaja - dan sekarang sidebar memang
          bisa digulir sendiri.

          Bilah gulir disembunyikan supaya tidak menambah satu garis lagi
          di panel yang warnanya sudah gelap. Gulir tetap jalan; yang hilang
          hanya batangnya. */}
      <aside className="ppi-side pf-side-scroll sticky top-20 hidden w-full flex-col self-start p-4 lg:flex">
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

        {/* Blok "top": slot actions dipanjatkan ke paling atas
            (halaman Riwayat menaruh Filter Status di sini). */}
        {actionsPosition === "top" ? (
          <>
            {actions ? <div className="mt-3 space-y-0.5">{actions}</div> : null}
            <hr className="ppi-side-hr my-4" />
          </>
        ) : null}

        <nav className={actionsPosition === "top" ? "space-y-0.5" : "mt-3 space-y-0.5"}>
          {leadingLinks.map((l) => (
            <SideButtonLink key={l.label} href={l.href} label={l.label} icon={<l.icon size={15} />} active={l.active} />
          ))}
        </nav>

        {/* Bawa-an: actions nempel di bawah dua menu teratas tanpa
            jarak ekstra (diminta owner) - garis pemisah tetap sebelum
            menu sisanya. */}
        {actionsPosition === "afterLeading" ? (
          <>
            {actions ? <div className="space-y-0.5">{actions}</div> : null}
            <hr className="ppi-side-hr my-4" />
          </>
        ) : null}

        <nav className="space-y-0.5">
          {trailingLinks.map((l) => (
            <SideButtonLink key={l.label} href={l.href} label={l.label} icon={<l.icon size={15} />} active={l.active} />
          ))}
          {isOwner ? (
            <SideButtonLink href="/pengaturan/invoice" label="Pengaturan" icon={<Settings size={15} />} active={pathname === "/pengaturan/invoice"} />
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

      {/* ======= HP / layar sempit =======
         Deretan tab di atas judul sudah dipindahkan ke bottom navigation
         (InvoiceBottomNav): Status/Menu, Riwayat, Baru, Katalog, Laporan.
         Yang tersisa di sini hanya pemilih Mode Dokumen. "Pengaturan"
         tidak ikut karena pintunya sudah ada di menu tiga titik header. */}
      <div className="space-y-2 lg:hidden">
        {modeBehavior !== "fixed" && !hideModeOnMobile ? (
          <div>
            <span className="mb-1 block px-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Mode Dokumen
            </span>
            {select}
          </div>
        ) : null}
      </div>

      <InvoiceBottomNav
        isOwner={isOwner}
        newHref={newHref}
        actions={actions}
        menuLabel={menuLabel}
      />
    </>
  );
}

/** Nama usaha di kop: gaya "Pamulang Printing" (kata terakhir beraksen). */
function SideButtonLink({ href, label, icon, active }: { href: string; label: string; icon: ReactNode; active?: boolean }) {
  return (
    <PrefetchLink href={href} className={`ppi-side-btn ${active ? "active" : ""}`}>
      <span className="ppi-ico">{icon}</span>
      {label}
    </PrefetchLink>
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
      <div className="min-w-0">
        {children}
        {/* Bottom nav Invoice tampil sampai lg, sedangkan padding bawah
            .app-main untuk tablet hanya 3rem. Ruang ini mencegah kartu
            terakhir tertutup navigasi. Di HP padding .app-main sudah
            cukup, jadi spacer hanya muncul di md sampai lg. */}
        <div className="hidden h-20 md:block lg:hidden no-print" aria-hidden />
      </div>
    </div>
  );
}

/**
 * Link navigasi modul invoice.
 *
 * prefetch={false} MATI karena alasan yang sama seperti menu utama:
 * dari tangkapan DevTools, tiap membuka /invoice causes /invoice/baru,
 * /invoice/katalog, /invoice/laporan, dan /pengaturan/invoice ikut
 * diunduh otomatis - padahal owner yang sedang cuma berpindah tab
 * filter tidak akan membuka satu pun dari halaman itu. Semuanya
 * berebut koneksi yang sama dengan tab yang sedang ditunggu.
 *
 * onPointerDown memindahkan waktu pramuat ke saat jari menyentuh: halaman
 * yang benar-benar mau dibuka tetap sudah siap sebelum jarinya mengangkat.
 */
function PrefetchLink({ href, className, children, "aria-current": ariaCurrent }: { href: string; className?: string; children: ReactNode; "aria-current"?: "page" | "true" | undefined }) {
  const router = useRouter();
  const prepare = useCallback(() => router.prefetch(href), [router, href]);
  return (
    <Link href={href} prefetch={false} onPointerDown={prepare} className={className} aria-current={ariaCurrent}>
      {children}
    </Link>
  );
}

/**
 * Tombol menu di sidebar (dipakai halaman untuk slot "actions").
 *
 * `active` menandai tombol yang sedang terpilih. Dulu tidak ada karena
 * semua pemakaiannya adalah perintah (Edit, Cetak, Hapus) - tidak pernah
 * ada tombol yang "sedang aktif". Sekarang deretan filter status juga
 * memakai komponen ini, jadi diperlukan tanda yang mana sedang dipakai.
 */
export function SideButton({
  icon,
  children,
  onClick,
  href,
  danger,
  disabled,
  title,
  active,
  ariaCurrent,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  active?: boolean;
  /** Nilai untuk aria-current; default "page" kalau active. */
  ariaCurrent?: "page" | "true" | false;
}) {
  const cls = `ppi-side-btn ${danger ? "danger" : ""} ${active ? "active" : ""}`;
  /* aria-current hanya boleh "page" atau "true" (atau tidak ada sama
     sekali). Nilai false dari pemanggil diterjemahkan jadi undefined
     supaya atributnya benar-benar tidak muncul di HTML, bukan
     muncul dengan nilai false - yang tidak valid untuk atribut ini. */
  const current = active ? (ariaCurrent === "page" ? "page" : "true") : undefined;
  const inner = (
    <>
      <span className="ppi-ico">{icon}</span>
      <span className="min-w-0 truncate">{children}</span>
    </>
  );
  if (href && !disabled) {
    return (
      <PrefetchLink href={href} className={cls} aria-current={current}>
        {inner}
      </PrefetchLink>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled} title={title} aria-current={current}>
      {inner}
    </button>
  );
}
