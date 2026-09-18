import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FileClock } from "lucide-react";
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
        <header className="app-header sticky top-0 z-30 border-b border-white/[0.09] bg-[#06303f]/85 shadow-[0_10px_34px_rgba(7,56,79,.22)] backdrop-blur-2xl no-print">
          {/* Garis aksen tipis: penanda brand teal → kuning di sisi paling atas layar. */}
          <div className="h-[3px] w-full bg-gradient-to-r from-teal-400 via-cyan-300 to-amber-300" />
          <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-3 py-2.5 sm:px-4 lg:px-6">
            <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="Ke Dashboard Print Flow">
              <AppLogo />
              <span className="leading-tight">
                <span className="block text-[15px] font-extrabold tracking-tight text-white md:text-base">Print&nbsp;Flow</span>
                <span className="hidden text-[10px] font-medium tracking-wide text-cyan-100/65 sm:block">
                  Monitoring Produksi Percetakan
                </span>
              </span>
            </Link>
            {user ? (
              <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
                <MainNav role={user.role} />
                <span className="mx-0.5 hidden h-6 w-px bg-white/15 md:block" />
                <UserMenu name={user.name} role={user.role} />
                <ThemeToggle />
                <MoreMenu role={user.role} />
              </div>
            ) : null}
          </div>
        </header>

        <main className="app-main mx-auto max-w-[1440px] px-3 pb-28 pt-5 sm:px-4 lg:px-6 md:pb-12">{children}</main>

        <footer className="mx-auto max-w-[1440px] px-4 pb-24 pt-3 text-xs text-slate-400 md:pb-8 no-print">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-teal-100 pt-5">
            <p className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-400" />
              Print Flow · Produksi lebih terpantau, pelanggan lebih tenang.
            </p>
            <div className="flex items-center gap-3">
              <Link href="/panduan" className="font-bold text-teal-700 hover:underline">Panduan</Link>
              <Link href="/catatan-perubahan" className="inline-flex items-center gap-1 font-bold text-teal-700 hover:underline">
                <FileClock size={13} /> Catatan Perubahan
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
