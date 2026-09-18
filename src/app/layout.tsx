import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FileClock, Plus, Sparkles } from "lucide-react";
import "./globals.css";
import { AppLogo } from "@/components/AppLogo";
import { ExitOnBackConfirm } from "@/components/ExitOnBackConfirm";
import { MainNav } from "@/components/MainNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavigationFeedback } from "@/components/NavigationFeedback";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { UserMenu } from "@/components/UserMenu";
import { MoreMenu } from "@/components/MoreMenu";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Print Flow — Monitoring Produksi Percetakan",
  description:
    "Aplikasi monitoring pekerjaan percetakan bertenaga AI: pantau status tiap order, risiko telat, dan rekomendasi tindakan.",
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
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [user, requestHeaders] = await Promise.all([getCurrentUser(), headers()]);
  // Security boundary kedua: JWT valid tetapi akun dinonaktifkan/password di-reset.
  //
  // PENTING: jangan redirect langsung ke "/login". JWT di cookie masih valid
  // secara tanda tangan (berlaku 12 jam), jadi middleware akan menganggap
  // pengguna masih login dan melempar balik ke "/" — berputar tanpa henti.
  // Lewat /api/auth/logout, cookie basinya dihapus dulu, baru ke halaman login
  // lengkap dengan penjelasan kenapa sesinya berakhir.
  if (requestHeaders.get("x-print-flow-protected") === "1" && !user) {
    redirect("/api/auth/logout?alasan=sesi-berakhir");
  }
  return (
    <html lang="id" suppressHydrationWarning>
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
        <ExitOnBackConfirm />

        {/*
          HEADER — revisi UI
          Bars 1 (semua layar): marka + nama usaha di kiri, aksi akun di kanan.
          Navigasi utama hanya muncul di tablet ke atas; di HP navigation-nya
          pindah ke bawah (lihat MainNav → portal .mobile-bottom-nav).
        */}
        <header className="app-header sticky top-0 z-30 border-b border-white/10 bg-[linear-gradient(110deg,#05283a_0%,#07384f_44%,#0b4c5a_100%)] text-white shadow-[0_12px_40px_-20px_rgba(2,26,36,.98)] backdrop-blur-xl no-print">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 right-10 h-40 w-40 rounded-full bg-teal-300/10 blur-3xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(45,212,191,.6),rgba(251,191,36,.55),transparent)]"
          />
          <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-3 py-2 sm:px-4 lg:px-6">
            <Link
              href="/"
              className="group flex min-w-0 shrink items-center gap-2.5 md:shrink-0"
              aria-label="Print Flow — kembali ke dashboard"
            >
              <AppLogo size={38} />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[13px] font-black tracking-tight text-white md:text-base">
                  Print Flow
                </span>
                <span className="hidden text-[10px] font-medium text-cyan-100/70 sm:block">
                  Monitoring Produksi Percetakan
                </span>
              </span>
            </Link>

            {user ? (
              <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
                <MainNav role={user.role} />
                <Link
                  href="/pesanan/baru"
                  prefetch
                  className="btn-primary btn-sm ml-1 hidden shrink-0 !rounded-xl !bg-white/12 !text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18)] !hover:bg-white/20 xl:inline-flex"
                >
                  <Plus size={15} strokeWidth={2.8} />
                  Pekerjaan Baru
                </Link>
                <UserMenu name={user.name} role={user.role} />
                <ThemeToggle />
                <MoreMenu role={user.role} />
              </div>
            ) : (
              <ThemeToggle />
            )}
          </div>
        </header>

        <main className="app-main mx-auto max-w-[1440px] px-3 pb-28 pt-4 sm:px-4 lg:px-6 md:pb-12 md:pt-6">
          {children}
        </main>

        <footer className="mx-auto max-w-[1440px] px-4 pb-24 pt-4 text-xs md:pb-8 no-print">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-teal-100/70 pt-5 text-slate-400 dark:border-white/10">
            <p className="flex items-center gap-2">
              <BrandDot />
              Print Flow · Produksi lebih terpantau, pelanggan lebih tenang.
            </p>
            <div className="flex items-center gap-1.5">
              <Link href="/panduan" className="btn-ghost btn-sm !min-h-8 !rounded-lg !px-2.5 !text-[11px]">
                Panduan
              </Link>
              <Link href="/catatan-perubahan" className="btn-ghost btn-sm !min-h-8 !rounded-lg !px-2.5 !text-[11px] inline-flex items-center gap-1">
                <FileClock size={13} /> Catatan Perubahan
              </Link>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/70 bg-amber-50 px-2 py-1 text-[10px] font-extrabold text-amber-700">
                <Sparkles size={11} /> UI Revisi 3
              </span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

function BrandDot() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 shrink-0 rounded-full bg-[linear-gradient(140deg,#14b8a6,#fbbf24)] shadow-[0_0_0_3px_rgba(20,184,166,.14)]"
    />
  );
}
