import { AppLogo } from "@/components/AppLogo";

export default function Loading() {
  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center gap-6 px-4" aria-label="Memuat data">
      <div className="scale-150 animate-pulse">
        <AppLogo />
      </div>
      <div className="space-y-1 text-center">
        <p className="text-sm font-extrabold text-[#07384f] dark:text-slate-100">Print Flow</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Memuat data…</p>
      </div>
      <div className="h-1.5 w-52 overflow-hidden rounded-full bg-teal-950/10 dark:bg-white/10">
        <div className="navigation-progress h-full w-1/3 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-teal-300 shadow-[0_0_12px_rgba(251,191,36,.6)]" />
      </div>
    </div>
  );
}
