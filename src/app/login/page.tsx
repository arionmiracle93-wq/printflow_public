import { Suspense } from "react";
import { LockKeyhole } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Login — Print Flow" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[68vh] max-w-3xl items-center">
      <div className="card grid w-full overflow-hidden md:grid-cols-2">
        {/* Panel foto — di atas (pendek) saat mobile, jadi kolom kiri saat desktop.
            Cuma "Print Flow" + ikon di pojok kiri-atas, sisanya foto asli percetakan
            (isi /public/images/login-hero.jpg [desktop] & login-hero-mobile.jpg [HP] — foto sendiri, beda dari hero Dashboard). */}
        <div className="login-photo-bg relative isolate h-36 overflow-hidden text-white sm:h-44 md:h-auto md:min-h-[420px]">
          <video
            className="login-hero-video absolute inset-0 -z-20 hidden h-full w-full object-cover md:block"
            src="/videos/login-hero.mp4"
            poster="/images/login-hero.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="none"
          />
          <div className="absolute -bottom-16 -left-10 -z-10 h-48 w-48 rounded-full bg-teal-400/20 blur-3xl" />
          <div className="absolute -top-14 right-0 -z-10 h-40 w-40 rounded-full bg-amber-300/15 blur-3xl" />
          <div className="relative flex items-center gap-2.5 p-5 [text-shadow:0_1px_10px_rgba(0,0,0,.45)] md:p-6">
            <AppLogo />
            <span className="text-lg font-black tracking-tight md:text-xl">Print Flow</span>
          </div>
        </div>

        {/* Form login */}
        <div className="p-6">
          <div className="mb-5 flex items-center gap-2">
            <span className="icon-tile">
              <LockKeyhole size={17} />
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-[#07384f] dark:text-slate-100">Masuk ke akun Anda</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Gunakan akun Owner atau Karyawan.</p>
            </div>
          </div>
          <Suspense fallback={<p className="text-sm text-slate-500">Memuat form…</p>}>
            <LoginForm />
          </Suspense>
          <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            Lupa password? Minta Owner membuka{" "}
            <span className="font-bold text-slate-500 dark:text-slate-400">Kelola Pengguna</span> untuk mereset akun
            Anda.
          </p>
        </div>
      </div>
    </div>
  );
}
