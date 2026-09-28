import Link from "next/link";
import {
  Banknote,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Flame,
  FolderOpen,
  PackageCheck,
  Plus,
  ShieldAlert,
} from "lucide-react";
import "./dashboard.css";
import { AiAssistant } from "@/components/AiAssistant";
import { ProblemScreen } from "@/components/ProblemScreen";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { FocusActions, StatTile } from "@/components/dashboard/DashboardStats";
import {
  DueTodayPanel,
  HowItWorksPanel,
  PipelinePanel,
  RiskDonut,
  SectionHead,
} from "@/components/dashboard/DashboardPanels";
import { JobCard } from "@/components/dashboard/JobCard";
import { JobCarousel } from "@/components/dashboard/JobCarousel";
import { safeDb } from "@/lib/dbcheck";
import { buildDashboardInsight } from "@/lib/ai";
import { formatRupiah, todayISO } from "@/lib/domain";
import { listOrders, photoCounts } from "@/lib/queries";
import { outsourceCounts } from "@/lib/outsource-queries";

export const dynamic = "force-dynamic";

/**
 * ==========================================================================
 * DASHBOARD PRINT FLOW — VERSI REVISI UI
 * ==========================================================================
 * Yang DIUBAH hanyalah tampilan. Sumber data, query database, perhitungan
 * risiko AI, dan seluruh aksi (update status, kirim WA, salin pesan, buka
 * detail) tetap persis sama seperti versi sebelumnya.
 *
 * Ringkasan perubahan:
 *  1. HERO lebih ringkas + papan angka kaca (aktif/telat/waspada/siap).
 *  2. "Fokus & tindakan hari ini" naik ke atas, tampil sebagai kartu bernomor.
 *  3. KPI jadi kartu yang BISA DIKLIK menuju daftar pekerjaan terkait,
 *     lengkap dengan dukungan mode gelap.
 *  4. Kartu pekerjaan dirombak: nomor prioritas, chip meta, strip tahap
 *     berlabel, sisa waktu, dan tombol aksi yang lebih jelas.
 *  5. Carousel mobile dapat titik indikator; desktop tetap grid 2 kolom.
 *  6. Panel tahap, donut risiko, deadline hari ini, dan panduan AI
 *     dirapikan dengan header konsisten.
 * ==========================================================================
 */
export default async function DashboardPage() {
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
  // Ringkasan dashboard dihitung lokal agar halaman tidak menunggu API GPT/Claude.
  // Model bahasa tetap dipakai on-demand melalui panel Tanya AI.
  const insight = buildDashboardInsight(orders);
  const orderById = new Map(orders.map((o) => [o.id, o]));
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

  const topJobs = insight.insights.slice(0, 6);
  const piutang = Math.max(0, insight.stats.revenueActive - insight.stats.paidAmount);

  return (
    <div className="space-y-5 md:space-y-6">
      {/* ---------------- 1. HERO ---------------- */}
      <DashboardHero
        summary={insight.summary}
        highlights={insight.highlights.slice(0, 5)}
        totalActive={insight.stats.totalActive}
        late={insight.stats.late}
        risky={insight.stats.risky}
        ready={insight.stats.readyToPickup}
      />

      {/* ---------------- 2. FOKUS HARI INI ---------------- */}
      <FocusActions actions={insight.actions.slice(0, 6)} />

      {/* ---------------- 3. KPI ---------------- */}
      <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3 xl:grid-cols-6">
        <StatTile
          label="Pekerjaan aktif"
          value={String(insight.stats.totalActive)}
          icon={<ClipboardList size={17} />}
          href="/pesanan"
          accent="teal"
          hint="Sedang berjalan"
          delay={0}
        />
        <StatTile
          label="Terlambat"
          value={String(insight.stats.late)}
          icon={<Clock3 size={17} />}
          accent={insight.stats.late > 0 ? "rose" : "teal"}
          href="/pesanan"
          hint={insight.stats.late > 0 ? "Perlu tindakan hari ini" : "Semua aman"}
          delay={40}
        />
        <StatTile
          label="Waspada / risiko"
          value={String(insight.stats.risky)}
          icon={<ShieldAlert size={17} />}
          accent="amber"
          href="/pesanan"
          hint="Margin waktu tipis"
          delay={80}
        />
        <StatTile
          label="Siap diambil"
          value={String(insight.stats.readyToPickup)}
          icon={<PackageCheck size={17} />}
          accent="teal"
          href="/pesanan?status=siap"
          hint="Menunggu pelanggan"
          delay={120}
        />
        <StatTile
          label="Nilai order aktif"
          value={formatRupiah(insight.stats.revenueActive)}
          icon={<CircleDollarSign size={17} />}
          accent="sky"
          hint={`Piutang ± ${formatRupiah(piutang)}`}
          delay={160}
        />
        <StatTile
          label="DP / terbayar"
          value={formatRupiah(insight.stats.paidAmount)}
          icon={<Banknote size={17} />}
          accent="teal"
          hint="Total uang masuk"
          delay={200}
        />
      </section>

      {/* ---------------- 4. KONTEN UTAMA ---------------- */}
      <div className="relative isolate grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        {/* Glow ambient lembut — menyambung identitas warna dari hero */}
        <div className="pointer-events-none absolute -left-16 top-8 -z-10 h-64 w-64 rounded-full bg-teal-400/10 blur-3xl dark:bg-teal-400/[0.07]" />
        <div className="pointer-events-none absolute -right-10 bottom-0 -z-10 h-56 w-56 rounded-full bg-amber-300/10 blur-3xl dark:bg-amber-300/[0.05]" />

        <section className="space-y-4 lg:col-span-2">
          <SectionHead
            icon={<Flame size={17} />}
            title="Prioritas AI: urutan kerja"
            subtitle={
              topJobs.length
                ? `${topJobs.length} pekerjaan teratas berdasarkan skor risiko`
                : "Belum ada pekerjaan aktif"
            }
            href="/pesanan"
          />

          {topJobs.length === 0 ? (
            <div className="pf-card flex flex-col items-center p-10 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                <FolderOpen size={30} />
              </span>
              <p className="mt-4 text-sm font-extrabold text-[#07384f] dark:text-slate-100">
                Belum ada pekerjaan aktif
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Tambahkan pekerjaan pertama, AI akan langsung memantau statusnya.
              </p>
              <Link href="/pesanan/baru" className="btn-primary mt-4">
                <Plus size={16} /> Buat Pekerjaan Baru
              </Link>
            </div>
          ) : (
            <JobCarousel>
              {topJobs.map((item, i) => (
                <JobCard
                  key={item.orderId}
                  insight={item}
                  rank={i + 1}
                  photoCount={photoMap.get(item.orderId) ?? 0}
                  outsource={outsourceMap.get(item.orderId)}
                  dueDate={orderById.get(item.orderId)?.dueDate ?? ""}
                  dueTime={orderById.get(item.orderId)?.dueTime ?? ""}
                />
              ))}
            </JobCarousel>
          )}

          <PipelinePanel counts={counts} />
          <DueTodayPanel orders={dueToday} />
        </section>

        <section className="space-y-4">
          <RiskDonut
            aman={Math.max(0, insight.stats.totalActive - insight.stats.risky - insight.stats.late)}
            waspada={insight.stats.risky}
            terlambat={insight.stats.late}
          />
          <AiAssistant />
          <HowItWorksPanel />
        </section>
      </div>
    </div>
  );
}
