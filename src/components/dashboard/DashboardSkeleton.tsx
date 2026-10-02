/**
 * Kerangka muat dashboard.
 * Bentuknya mengikuti layout akhir (pita status, deret metrik, antrean,
 * kolom kanan) supaya tidak ada lompatan tata letak saat data datang.
 * Tidak memakai spinner bulat.
 */
export function DashboardSkeleton() {
  return (
    <div className="pf-dash space-y-5" aria-busy="true" aria-label="Memuat dashboard">
      <div className="pf-hero-stage space-y-5 lg:space-y-0">
      <div className="pf-hero-bleed pf-skel h-[270px] w-full rounded-[1.5rem] md:h-[260px]" />

      {/* Bentuknya mengikuti strip KPI: ikon besar di kiri, label, angka,
          dan garis tipis; enam kolom di layar lebar. */}
      <div className="pf-kpi-dock grid grid-cols-2 gap-y-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="pf-kpi relative py-3 pl-4 pr-2 md:pl-6 xl:pl-5">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 md:gap-x-3.5">
              <div className="pf-skel row-start-1 h-8 w-8 shrink-0 rounded-lg md:h-9 md:w-9" />
              <div className="row-start-1">
                <div className="pf-skel h-2.5 w-16" />
                <div className="pf-skel mt-2 h-6 w-12" />
              </div>
              <div className="pf-skel col-start-2 row-start-2 mt-2 h-[3px] w-24" />
            </div>
          </div>
        ))}
      </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <div className="pf-surface overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-[color:var(--pf-line-soft)] p-3 last:border-b-0">
                <div className="pf-skel h-8 w-8 rounded-full" />
                <div className="min-w-0 flex-1">
                  <div className="pf-skel h-3.5 w-2/3" />
                  <div className="pf-skel mt-2 h-2.5 w-1/3" />
                </div>
                <div className="pf-skel hidden h-3 w-24 sm:block" />
                <div className="pf-skel h-8 w-20" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4 lg:col-span-4">
          <div className="pf-skel h-40 w-full" />
          <div className="pf-skel h-52 w-full" />
        </div>
      </div>
    </div>
  );
}
