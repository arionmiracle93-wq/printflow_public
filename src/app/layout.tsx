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
  // Halaman login punya desain sendiri (kartu kaca di atas gradient tebal,
  // lihat globals.css bagian "login-shell") — flag ini yang bikin header
  // bawaan disembunyikan & footer disesuaikan TANPA menyentuh halaman lain.
  const isLoginPage = requestHeaders.get("x-print-flow-pathname") === "/login";
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
      <body className={`min-h-screen antialiased${isLoginPage ? " login-shell" : ""}`}>
        <NavigationFeedback />
        <ServiceWorkerRegister />
        <ExitOnBackConfirm />
        <header className="app-header sticky top-0 z-30 border-b border-white/10 bg-[#07384f]/95 shadow-[0_8px_30px_rgba(7,56,79,.14)] backdrop-blur-xl no-print">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-2.5 lg:px-6">
            <Link href="/" className="group hidden shrink-0 items-center gap-2.5 md:flex">
              <AppLogo />
              <span className="leading-tight">
                <span className="block text-sm font-extrabold tracking-tight text-white md:text-base">Print Flow</span>
                <span className="hidden text-[10px] font-medium text-cyan-100/70 sm:block">Monitoring Produksi Percetakan</span>
              </span>
            </Link>
            {user ? (
              <div className="flex w-full items-center justify-between gap-2 md:w-auto md:justify-end">
                <MainNav role={user.role} />
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
            <p>Print Flow · Produksi lebih terpantau, pelanggan lebih tenang.</p>
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
