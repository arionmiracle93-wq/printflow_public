import { Suspense } from "react";
import { LockKeyhole, PackageCheck, ShieldCheck, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Login — Print Flow" };

const HIGHLIGHTS = [
  { icon: Sparkles, text: "Risiko telat dihitung otomatis tiap perubahan status" },
  { icon: PackageCheck, text: "Satu layar untuk semua pekerjaan: antrian sampai siap ambil" },
  { icon: ShieldCheck, text: "Akun internal — pelanggan tidak ikut masuk ke aplikasi" },
];

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center py-2">
      <div className="card grid w-full overflow-hidden !p-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* Panel brand */}
        <div className="relative isolate overflow-hidden bg-[#062f43] p-6 text-white md:p-7">
          <span aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,rgba(20,184,166,.46),transparent_46%,rgba(251,191,36,.2))]" />
          <span aria-hidden="true" className="absolute -bottom-16 -right-10 -z-10 h-40 w-40 rotate-12 rounded-[2rem] bg-amber-300/85 blur-[1px]" />
          <span aria-hidden="true" className="absolute -left-14 -top-16 -z-10 h-56 w-56 rounded-full border-[40px] border-teal-300/10" />
          <span aria-hidden="true" className="absolute right-8 top-4 -z-10 h-32 w-32 rounded-full bg-teal-300/20 blur-3xl" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(251,191,36,.6),transparent)]" />

          <BrandMark size={52} />
          <h1 className="mt-4 text-2xl font-black leading-tight tracking-tight md:text-3xl">Print Flow</h1>
          <p className="mt-1 text-sm font-medium text-cyan-50/80">Monitoring Produksi Percetakan</p>

          <ul className="mt-6 space-y-2.5">
            {HIGHLIGHTS.map((h) => {
              const Icon = h.icon;
              return (
                <li key={h.text} className="flex items-start gap-2.5 text-[12px] leading-relaxed text-cyan-50/85">
                  <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/12 text-teal-200">
                    <Icon size={13} />
                  </span>
                  <span>{h.text}</span>
                </li>
              );
            })}
          </ul>

          <p className="mt-7 rounded-xl border border-white/12 bg-white/[0.07] px-3 py-2 text-[11px] leading-relaxed text-cyan-50/75">
            Lupa password? Minta Owner membuka <strong className="font-extrabold text-white">Kelola Pengguna</strong> untuk
            mereset akun Anda.
          </p>
        </div>

        {/* Panel form */}
        <div className="p-6 md:p-7">
          <div className="flex items-center gap-2.5">
            <span className="icon-tile"><LockKeyhole size={17} /></span>
            <div>
              <h2 className="text-base font-extrabold text-[#07384f] dark:text-slate-100">Masuk ke akun Anda</h2>
              <p className="text-[11px] text-slate-500">Gunakan akun Owner atau Karyawan.</p>
            </div>
          </div>
          <div className="mt-5">
            <Suspense fallback={<p className="text-sm text-slate-500">Memuat form…</p>}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
