import type { Metadata, Viewport } from "next";
import { Calistoga, Geist, Geist_Mono, Inter } from "next/font/google";

import type { ReactNode } from "react";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { FileClock } from "lucide-react";
import "./globals.css";
import { AppLogo } from "@/components/AppLogo";
import { ExitOnBackConfirm } from "@/components/ExitOnBackConfirm";
import { MainNav } from "@/components/MainNav";
import { ModuleSwitcher } from "@/components/ModuleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavigationFeedback } from "@/components/NavigationFeedback";
import { AutoRefresh } from "@/components/AutoRefresh";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PaymentQueueSync } from "@/components/PaymentQueueSync";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SessionKeepAlive } from "@/components/SessionKeepAlive";
import { UserMenu } from "@/components/UserMenu";
import { QuickSearch } from "@/components/QuickSearch";
import { MoreMenu } from "@/components/MoreMenu";
import { getCurrentUser } from "@/lib/auth";
import { getInvoiceAccess } from "@/lib/invoice-access";

/**
 * Tipografi.
 * Dimuat lewat next/font supaya berkas font ikut dihosting sendiri,
 * tidak ada permintaan ke server pihak ketiga saat halaman dibuka,
 * dan tidak ada kedipan teks. Nama variabelnya dipakai oleh
 * design-tokens.css. Kalau baris ini dihapus, tumpukan font sistem
 * otomatis dipakai dan tidak ada halaman yang rusak.
 */
const sans = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
// Khusus enam kartu KPI di dashboard (kelas .pf-kpi di dashboard.css), supaya
// hurufnya sama dengan gambar acuan. Bagian aplikasi lain tetap Geist.
const kpiFont = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-kpi", display: "swap" });
// Huruf display khusus beranda desktop. Calistoga dipakai untuk sapaan agar
// beranda terasa seperti cover aplikasi, bukan halaman dashboard biasa.
const displayFont = Calistoga({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "Print Flow - Produksi & Invoice",
  description:
    "Aplikasi percetakan dengan dua modul setara: Produksi (antrean, status, tahapan pekerjaan) dan Invoice (tagihan, pembayaran, laporan).",
  manifest: "/api/pwa/manifest",
  icons: {
    icon: [
      { url: "/api/pwa/icon/192.png?v=printer-2", sizes: "192x192", type: "image/png" },
      { url: "/api/pwa/icon/512.png?v=printer-2", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/api/pwa/icon/192.png?v=printer-2", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Print Flow" },
};

export const viewport: Viewport = {
  themeColor: "#07384f",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [user, requestHeaders, cookieStore] = await Promise.all([getCurrentUser(), headers(), cookies()]);
  // Security boundary kedua: JWT valid tetapi akun dinonaktifkan/password di-reset.
  //
  // PENTING: jangan redirect langsung ke "/login". JWT di cookie masih valid
  // secara tanda tangan (berlaku 12 jam), jadi middleware akan menganggap
  // pengguna masih login dan melempar balik ke "/" - berputar tanpa henti.
  // Lewat /api/auth/logout, cookie basinya dihapus dulu, baru ke halaman login
  // lengkap dengan penjelasan kenapa sesinya berakhir.
  if (requestHeaders.get("x-print-flow-protected") === "1" && !user) {
    redirect("/api/auth/logout?alasan=sesi-berakhir");
  }
  // Izin Invoice dipakai oleh tiga tempat sekaligus: switcher modul di
  // header, dan kartu di home screen. Nilainya di sini dihitung SATU
  // kali per request; halaman yang membutuhkannya memanggil
  // getInvoiceAccess() lagi, dan karena fungsi itu dibungkus cache()
  // dari React, hasilnya dipakai bersama - bukan query kedua.
  //
  // Kalau database belum diperbarui lewat /api/setup (kolom izin belum
  // ada), nilainya tetap false dan tidak ada yang rusak - paling buruk
  // kartu Invoice terlihat terkunci.
  let canInvoice = false;
  if (user) {
    try {
      canInvoice = Boolean(await getInvoiceAccess());
    } catch {
      canInvoice = false;
    }
  }
  // Cookie modul terakhir hanya dipakai untuk menyorot segmen switcher
  // di halaman bersama. Nilainya TIDAK dipakai untuk redirect - aturan
  // D-03. Nilai yang tidak dikenal diperlakukan sebagai "belum ada".
  const modulTerakhirCookie = cookieStore.get("print-flow-module")?.value;
  const modulTerakhir =
    modulTerakhirCookie === "produksi" || modulTerakhirCookie === "invoice"
      ? modulTerakhirCookie
      : null;
  // Halaman login & setup-akun tidak perlu shell (header + footer) sama sekali -
  // keduanya punya desain full-screen sendiri. Middleware set header ini supaya
  // layout bisa menyembunyikan elemen shell tanpa perlu tahu URL-nya langsung.
  const noShell = requestHeaders.get("x-print-flow-no-shell") === "1";
  // Halaman lacak dibuka pelanggan lewat WhatsApp. Jangan tampilkan header/footer
  // aplikasi di sana: identitas yang boleh terlihat hanya nama + logo usaha.
  const isLacak = requestHeaders.get("x-print-flow-lacak") === "1";
  // Tautan "Panduan" & "Catatan Perubahan" di footer hanya untuk pengguna
  // internal yang sudah login, dan tidak ditampilkan di halaman tautan lacak
  // yang dibuka pelanggan.
  const tampilTautanFooter = Boolean(user) && !isLacak;
  return (
    <html lang="id" suppressHydrationWarning className={`${sans.variable} ${mono.variable} ${kpiFont.variable} ${displayFont.variable}`}>
      <head>
        <script
          // Jalan sebelum konten dicat, supaya tidak ada kedipan putih
          // sesaat sebelum berpindah ke tema gelap saat aplikasi dibuka.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('print-flow-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <NavigationFeedback />
        <ServiceWorkerRegister />
        <OfflineBanner />
        {user ? <SessionKeepAlive /> : null}
        {user ? <PaymentQueueSync /> : null}
        {user ? <AutoRefresh /> : null}
        <ExitOnBackConfirm />
        {!noShell && !isLacak && (<header className="app-header sticky top-0 z-30 border-b border-teal-100/80 bg-white/95 shadow-[0_8px_30px_rgba(7,56,79,.10)] backdrop-blur-xl no-print dark:border-white/10 dark:bg-[#081420]/95 dark:shadow-[0_8px_30px_rgba(0,0,0,.28)]">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-2.5 lg:px-6">
            {/* Logo -> home. "/" sekarang home screen pemilih modul,
                sebelumnya dashboard Produksi.
                Di bawah md logo ini disembunyikan, jadi pengguna HP tidak
                punya akses lewat sini - mereka sampai ke home lewat
                "Beranda" di menu tiga titik (MoreMenu) dan lewat kartu
                di halaman ModuleHome. */}
            <Link href="/" className="group hidden shrink-0 items-center gap-2.5 md:flex">
              <AppLogo />
              <span className="leading-tight">
                <span className="block text-sm font-semibold tracking-tight text-[color:var(--pf-ink)] md:text-base dark:text-white">Print Flow</span>
                <span className="hidden text-[10px] font-medium text-[color:var(--pf-ink-2)] sm:block">Produksi &amp; Invoice</span>
              </span>
            </Link>
            {user ? (
              <div className="flex w-full items-center justify-between gap-2 md:w-auto md:justify-end">
                <MainNav />
                <ModuleSwitcher bisaInvoice={canInvoice} modulTerakhir={modulTerakhir} />
                <UserMenu name={user.name} role={user.role} />
                <QuickSearch />
                <ThemeToggle />
                <MoreMenu role={user.role} bisaInvoice={canInvoice} />
              </div>
            ) : null}
          </div>
        </header>)}

        <main
          className={
            noShell
              ? "app-main"
              : isLacak
                ? "mx-auto max-w-[1440px] px-3 pb-10 pt-5 sm:px-4 lg:px-6"
                : "app-main mx-auto max-w-[1440px] px-3 pb-28 pt-5 sm:px-4 lg:px-6 md:pb-12"
          }
        >
          {children}
        </main>

        {!noShell && !isLacak && (<>{/* Padding bawah baru mengecil di lg, bukan md: bottom nav Invoice
            juga tampil di tablet (md-lg), jadi tautan footer jangan
            tertutup navigasi tetap di sana. */}
        <footer className="mx-auto max-w-[1440px] px-4 pb-24 pt-3 text-xs text-slate-400 lg:pb-8 no-print">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-teal-100 pt-5">
            <p>Print Flow - Produksi terpantau, tagihan terkendali.</p>
            {tampilTautanFooter ? (
              <div className="flex items-center gap-2.5">
                <Link href="/panduan" className="font-bold text-teal-700 hover:underline">Panduan</Link>
                <Link href="/catatan-perubahan" className="inline-flex items-center gap-2 font-bold text-teal-700 hover:underline">
                  <FileClock size={17} /> Catatan Perubahan
                </Link>
              </div>
            ) : null}
          </div>
        </footer></>)}
      </body>
    </html>
  );
}
