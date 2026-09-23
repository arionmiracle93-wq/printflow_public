import { Suspense } from "react";
import { LockKeyhole } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Login — Print Flow" };

export default function LoginPage() {
  return (
    <div className="login-card">
      {/* Panel foto/video — pendek di atas saat mobile, kolom kiri saat
          desktop. Video asli percetakan TETAP dipakai (login-hero.mp4),
          cuma sekarang jadi bagian dari kartu kaca besar ala referensi. */}
      <div className="login-photo-bg relative isolate h-40 overflow-hidden text-white sm:h-48 md:h-auto md:min-h-[460px]">
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
        <div className="absolute -bottom-16 -left-10 -z-10 h-52 w-52 rounded-full bg-amber-300/25 blur-3xl" />
        <div className="absolute -top-14 right-0 -z-10 h-44 w-44 rounded-full bg-teal-300/20 blur-3xl" />

        <div className="relative flex items-center gap-2.5 p-5 [text-shadow:0_1px_10px_rgba(0,0,0,.45)] md:p-7">
          <AppLogo />
          <span>
            <span className="block text-lg font-black tracking-tight md:text-xl">Print Flow</span>
            <span className="hidden text-[11px] font-medium text-cyan-50/75 md:block">
              Monitoring Produksi Percetakan
            </span>
          </span>
        </div>
      </div>

      {/* Panel form — kaca gelap, sesuai referensi */}
      <div className="login-form-panel">
        <div className="mb-6 flex items-center gap-3">
          <span className="login-icon-badge">
            <LockKeyhole size={18} />
          </span>
          <div>
            <h2 className="text-sm font-extrabold text-white">Masuk ke akun Anda</h2>
            <p className="text-[11px] text-teal-100/60">Gunakan akun Owner atau Karyawan.</p>
          </div>
        </div>
        <Suspense fallback={<p className="text-sm text-teal-100/60">Memuat form…</p>}>
          <LoginForm />
        </Suspense>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-teal-100/50">
          Lupa password? Minta Owner membuka{" "}
          <span className="font-bold text-teal-100/80">Kelola Pengguna</span> untuk mereset akun Anda.
        </p>
      </div>
    </div>
  );
}
