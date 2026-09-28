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
import { formatRupiah, todayISO } from "@/lib/domain";
import { listOrders, photoCounts } from "@/lib/queries";
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
  const result = await safeDb(async () => {
    const rows = await listOrders({ scope: "semua" });
    const ids = rows.map((r) => r.id);
    const [counts, outsourced] = await Promise.all([photoCounts(ids), outsourceCounts(ids)]);
    return { rows, counts, outsourced };
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

  const dueMap = new Map(orders.map((o) => [o.id, { dueDate: o.dueDate, dueTime: o.dueTime }]));
  const counts = new Map<string, number>();
  for (const order of orders) counts.set(order.status, (counts.get(order.status) ?? 0) + 1);

  const today = todayISO();
  const dueToday = orders
    .filter((o) => o.dueDate === today && o.status !== "selesai" && o.status !== "batal")
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

      {/* Kartu KPI asli. Komponen KpiCard di src/components/ui.tsx dipakai
          apa adanya, susunan gridnya juga sama seperti versi original. */}
      <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3 xl:grid-cols-6">
        <KpiCard label="Pekerjaan aktif" value={String(insight.stats.totalActive)} icon={<ClipboardList size={18} />} />
        <KpiCard
          label="Terlambat"
          value={String(insight.stats.late)}
          tone={insight.stats.late > 0 ? "text-rose-600" : "text-teal-700"}
          icon={<Clock3 size={18} />}
          accent={insight.stats.late > 0 ? "rose" : "teal"}
          hint={insight.stats.late > 0 ? "Perlu tindakan" : "Semua aman"}
        />
        <KpiCard
          label="Waspada / risiko"
          value={String(insight.stats.risky)}
          tone="text-amber-600"
          icon={<ShieldAlert size={18} />}
          accent="yellow"
        />
        <KpiCard
          label="Siap diambil"
          value={String(insight.stats.readyToPickup)}
          tone="text-teal-700"
          icon={<PackageCheck size={18} />}
        />
        <KpiCard
          label="Nilai order aktif"
          value={formatRupiah(insight.stats.revenueActive)}
          tone="text-sky-700"
          icon={<CircleDollarSign size={18} />}
          accent="blue"
        />
        <KpiCard
          label="DP / terbayar"
          value={formatRupiah(insight.stats.paidAmount)}
          tone="text-teal-700"
          icon={<Banknote size={18} />}
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
