import { AppLogo } from "@/components/AppLogo";

/**
 * Pengganti layar kosong saat halaman berpindah.
 *
 * Revisi UI: bentuknya mengikuti kerangka dashboard (hero → KPI → kartu)
 * supaya mata pengguna tidak "melompat" saat data selesai dimuat, dan ada
 * keterangan eksplisit apa yang sedang dibaca agar tidak dikira macet.
 */
export default function Loading() {
  return (
    <div className="space-y-5" aria-live="polite" aria-busy="true">
      <div className="flex items-center justify-center gap-3 py-2">
        <div className="animate-pulse">
          <AppLogo size={34} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-extrabold text-[#07384f] dark:text-slate-100">Print Flow</p>
          <p className="text-[11px] text-slate-500">Mengambil data produksi terbaru…</p>
        </div>
        <div className="ml-2 h-1.5 w-24 overflow-hidden rounded-full bg-teal-950/10 dark:bg-white/10">
          <div className="navigation-progress h-full w-1/3 rounded-full bg-[linear-gradient(90deg,#fcd34d,#2dd4bf)] shadow-[0_0_12px_rgba(251,191,36,.6)]" />
        </div>
      </div>

      <div className="skeleton h-[168px] w-full rounded-[1.4rem]" />

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-[92px] rounded-2xl" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-[212px] rounded-[1.15rem]" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    </div>
  );
}
