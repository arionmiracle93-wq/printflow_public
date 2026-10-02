import { Suspense } from "react";
import {
  Banknote,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  PackageCheck,
  ShieldAlert,
} from "lucide-react";
import { AiAssistant } from "@/components/AiAssistant";
import { ProblemScreen } from "@/components/ProblemScreen";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { KpiCard } from "@/components/ui";
import { JobQueue } from "@/components/dashboard/JobQueue";
import {
  ActionList,
  DueToday,
  EmptyQueue,
  RiskDonut,
  SectionHeading,
  StagePositions,
  type RiskCounts,
} from "@/components/dashboard/Panels";
import { safeDb } from "@/lib/dbcheck";
import { buildDashboardInsight } from "@/lib/ai";
import { buildKpiBars } from "@/lib/kpi-bars";
import { formatRupiah, todayISO } from "@/lib/domain";
import { listOrders, paidTotal, photoCounts, statusCounts } from "@/lib/queries";
import { outsourceCounts } from "@/lib/outsource-queries";

export const dynamic = "force-dynamic";

/**
 * =========================================================================
 * DASHBOARD PRINT FLOW
 * =========================================================================
 * Mode redesign: PRESERVE.
 * Warna merek, rute, label navigasi, dan seluruh aturan bisnis di
 * src/lib tidak disentuh. Yang dikerjakan hanya lapisan tampilan.
 *
 * Urutan baca yang dituju, dari atas ke bawah:
 *   1. Hero foto (desain original) dengan ringkasan dan sorotan AI.
 *   2. Enam kartu KPI (desain original).
 *   3. Pekerjaan mana yang harus disentuh lebih dulu.
 *   4. Konteks: posisi per tahap, tenggat, tindakan, diagram risiko, tanya AI.
 *
 * Kepadatan sengaja dinaikkan dibanding versi sebelumnya karena ini
 * layar operasional, bukan halaman promosi. Kartu hanya dipakai kalau
 * elevasinya benar-benar menandai pengelompokan.
 * =========================================================================
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  // Hanya pekerjaan AKTIF yang dimuat (antrian sampai siap, plus ditunda).
  // Dulu semua pekerjaan dimuat, termasuk yang sudah selesai berbulan-bulan
  // lalu, sehingga beranda makin lambat seiring data bertambah. Angka yang
  // butuh semua data (jumlah per tahap, total uang masuk) dihitung langsung
  // oleh database, hasilnya sama persis dengan sebelumnya.
  const result = await safeDb(async () => {
    const [rows, stageCounts, paid] = await Promise.all([listOrders({ scope: "aktif" }), statusCounts(), paidTotal()]);
    const ids = rows.map((r) => r.id);
    const [counts, outsourced] = await Promise.all([photoCounts(ids), outsourceCounts(ids)]);
    return { rows, counts, outsourced, stageCounts, paid };
  });

  if (!result.ok) {
    return (
      <ProblemScreen
        problem={result.problem}
        hint="Dashboard butuh database untuk menghitung status pekerjaan."
      />
    );
  }

  const orders = result.data.rows;
  const photoMap = result.data.counts;
  const outsourceMap = result.data.outsourced;

  // Ringkasan dihitung lokal supaya halaman tidak menunggu API model bahasa.
  // Model bahasa tetap dipakai sesuai permintaan lewat panel Tanya AI.
  const insight = buildDashboardInsight(orders);
  // buildDashboardInsight menjumlah uang masuk dari pekerjaan yang diberikan
  // (sekarang hanya yang aktif). KPI "DP / terbayar" tetap memakai total
  // semua pekerjaan kecuali batal, seperti sebelumnya.
  insight.stats.paidAmount = result.data.paid;

  // Isi garis progres tipis di tiap kartu KPI (lihat src/lib/kpi-bars.ts).
  const bars = buildKpiBars(orders, insight.stats);

  const dueMap = new Map(orders.map((o) => [o.id, { dueDate: o.dueDate, dueTime: o.dueTime }]));
  // Jumlah per tahap (termasuk Selesai dan Batal) untuk panel "Posisi pekerjaan per tahap".
  const counts = result.data.stageCounts;

  const today = todayISO();
  const dueToday = orders
    .filter((o) => o.dueDate === today && o.status !== "selesai" && o.status !== "batal" && o.status !== "siap")
    .sort((a, b) => a.dueTime.localeCompare(b.dueTime))
    .map((o) => ({
      id: o.id,
      code: o.code,
      title: o.title,
      status: o.status,
      dueTime: o.dueTime,
      customerName: o.customerName,
    }));

  const jobs = insight.insights.slice(0, 8);

  // Sebaran risiko per level, dihitung dari riskLevel tiap pekerjaan aktif
  // (hasil analyzeOrder), supaya cocok dengan badge risiko di kartu pekerjaan.
  const riskCounts: RiskCounts = { aman: 0, waspada: 0, risiko: 0, terlambat: 0 };
  for (const item of insight.insights) riskCounts[item.riskLevel] += 1;
  const averageScore = insight.insights.length
    ? insight.insights.reduce((sum, item) => sum + item.riskScore, 0) / insight.insights.length
    : 0;

  return (
    <div className="pf-dash space-y-5">
      {/* Hero foto desain original, lengkap dengan carousel Insight AI. */}
      <DashboardHero summary={insight.summary} highlights={insight.highlights.slice(0, 5)} />

      {/* Enam KPI gaya strip datar (ikon besar, angka, garis progres tipis,
          dipisah garis vertikal). Ikon tetap versi original; hover hanya naik
          sedikit. Tampilan diatur oleh KpiCard di src/components/ui.tsx dan
          .pf-kpi di src/app/dashboard.css. Garis progres mewakili data nyata:
          lihat src/lib/kpi-bars.ts untuk arti tiap garis. */}
      <section className="grid grid-cols-2 gap-y-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Pekerjaan aktif" value={String(insight.stats.totalActive)} icon={<ClipboardList size={18} />} bar={bars.aktif.pct} barLabel={bars.aktif.label} />
        <KpiCard
          label="Terlambat"
          value={String(insight.stats.late)}
          tone={insight.stats.late > 0 ? "text-rose-600" : "text-teal-700"}
          icon={<Clock3 size={18} />}
          accent={insight.stats.late > 0 ? "rose" : "teal"}
          hint={insight.stats.late > 0 ? "Perlu tindakan" : "Semua aman"}
          bar={bars.terlambat.pct}
          barLabel={bars.terlambat.label}
        />
        <KpiCard
          label="Waspada / risiko"
          value={String(insight.stats.risky)}
          tone="text-amber-600"
          icon={<ShieldAlert size={18} />}
          accent="yellow"
          bar={bars.risiko.pct}
          barLabel={bars.risiko.label}
        />
        <KpiCard
          label="Siap diambil"
          value={String(insight.stats.readyToPickup)}
          tone="text-teal-700"
          icon={<PackageCheck size={18} />}
          bar={bars.siap.pct}
          barLabel={bars.siap.label}
        />
        <KpiCard
          label="Nilai order aktif"
          value={formatRupiah(insight.stats.revenueActive)}
          tone="text-sky-700"
          icon={<CircleDollarSign size={18} />}
          accent="blue"
          bar={bars.nilai.pct}
          barLabel={bars.nilai.label}
        />
        <KpiCard
          label="DP / terbayar"
          value={formatRupiah(insight.stats.paidAmount)}
          tone="text-teal-700"
          icon={<Banknote size={18} />}
          bar={bars.dp.pct}
          barLabel={bars.dp.label}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="min-w-0 space-y-4 lg:col-span-8">
          <div className="pf-enter" style={{ ["--pf-delay" as string]: "120ms" }}>
            <SectionHeading
              title="Antrean prioritas"
              meta={
                jobs.length
                  ? `${jobs.length} teratas dari ${insight.stats.totalActive} pekerjaan aktif, diurutkan dari skor risiko tertinggi`
                  : undefined
              }
              action={{ href: "/pesanan", label: "Semua" }}
            />
            {jobs.length === 0 ? (
              <EmptyQueue />
            ) : (
              <JobQueue jobs={jobs} photoCounts={photoMap} outsource={outsourceMap} due={dueMap} />
            )}
          </div>

          <StagePositions counts={counts} />
          <DueToday orders={dueToday} />
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-4">
          <ActionList actions={insight.actions.slice(0, 5)} />
          <RiskDonut counts={riskCounts} averageScore={averageScore} />
          <AiAssistant />
        </div>
      </div>
    </div>
  );
}
