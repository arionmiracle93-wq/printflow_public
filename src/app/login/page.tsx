import { Suspense } from "react";
import { LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Login — Print Flow" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
      <div className="card w-full overflow-hidden shadow-[var(--sh-3)]">
        {/* Kepala kartu: panel brand dengan gradien teal → navy. */}
        <div className="relative isolate overflow-hidden bg-[#06303f] p-7 text-center text-white">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(600px_280px_at_15%_0%,rgba(20,184,166,.5),transparent_62%),radial-gradient(520px_260px_at_100%_20%,rgba(8,145,178,.4),transparent_60%)]" />
          <div className="absolute -bottom-16 -right-12 -z-10 h-40 w-40 rotate-12 rounded-[2rem] bg-amber-300/85 blur-[2px]" />
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-teal-400 via-cyan-300 to-amber-300" />

          <span className="mx-auto block w-fit drop-shadow-[0_6px_18px_rgba(0,0,0,.35)]">
            <BrandMark />
          </span>
          <h1 className="mt-3 text-[1.7rem] font-black tracking-tight">Print Flow</h1>
          <p className="mt-1 text-sm text-cyan-50/75">Monitoring Produksi Percetakan</p>
          <p className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-cyan-50/85">
            <Sparkles size={11} className="text-amber-300" /> Dibantu analisa AI
          </p>
        </div>

        <div className="p-6">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="icon-tile">
              <LockKeyhole size={17} />
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-[#07384f]">Masuk ke akun Anda</h2>
              <p className="text-[11px] text-slate-500">Gunakan akun Owner atau Karyawan.</p>
            </div>
          </div>

          <Suspense fallback={<div className="space-y-3"><div className="skeleton h-10 w-full" /><div className="skeleton h-10 w-full" /><div className="skeleton h-10 w-2/5" /></div>}>
            <LoginForm />
          </Suspense>

          <p className="mt-5 flex items-center justify-center gap-1.5 border-t border-slate-100 pt-4 text-[11px] font-medium text-slate-400">
            <ShieldCheck size={12} className="text-teal-600" />
            Sesi terenkripsi · otomatis berakhir setelah 12 jam
          </p>
        </div>
      </div>
    </div>
  );
}
