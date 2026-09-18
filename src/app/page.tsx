import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Flame,
  FolderOpen,
  PackageCheck,
  Plus,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import { AiAssistant } from "@/components/AiAssistant";
import { DashboardHero, AiSummaryBand, StatTile } from "@/components/DashboardHero";
import { ProblemScreen } from "@/components/ProblemScreen";
import { InsightCard, ProgressBar } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { safeDb } from "@/lib/dbcheck";
import { buildDashboardInsight } from "@/lib/ai";
import { STATUSES, formatRupiah, statusMeta } from "@/lib/domain";
import { listOrders, photoCounts } from "@/lib/queries";
import { outsourceCounts } from "@/lib/outsource-queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const result = await safeDb(async () => {
    const rows = await listOrders({ scope: "semua" });
    const ids = rows.map((r) => r.id);
    const [counts, outsourced] = await Promise.all([photoCounts(ids), outsourceCounts(ids)]);
    return { rows, counts, outsourced };
  });
  if (!result.ok) {
    return <ProblemScreen problem={result.problem} hint="Dashboard butuh database untuk menghitung status pekerjaan." />;
  }

  const user = await getCurrentUser();
  const orders = result.data.rows;
  const photoMap = result.data.counts;
  const outsourceMap = result.data.outsourced;
  // Ringkasan dashboard dihitung lokal agar halaman tidak menunggu API GPT/Claude.
  // Model bahasa tetap dipakai on-demand melalui panel Tanya AI.
  const insight = buildDashboardInsight(orders);
  const summary = { summary: insight.summary, source: "engine" };
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const counts = new Map<string, number>();
  for (const order of orders) counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
  const maxCount = Math.max(1, ...STATUSES.map((s) => counts.get(s.key) ?? 0));

  return (
    <div className="space-y-4 md:space-y-5">
      <style dangerouslySetInnerHTML={{ __html: `.app-header { display: none !important; } .app-main { padding-top: 1rem !important; }` }} />
      {/* HERO — banner foto realistis bergaya aplikasi referensi */}
      <DashboardHero name={user?.name ?? "Pemilik"} />

      {/* KPI — category tiles */}
      <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3 xl:grid-cols-6">
        <StatTile label="Pekerjaan aktif" value={String(insight.stats.totalActive)} accent="teal" icon={<ClipboardList size={19} />} />
        <StatTile
          label="Terlambat"
          value={String(insight.stats.late)}
          alert={insight.stats.late > 0}
          accent={insight.stats.late > 0 ? "rose" : "teal"}
          tone={insight.stats.late > 0 ? "text-rose-600" : "text-teal-700"}
          hint={insight.stats.late > 0 ? "Perlu tindakan" : "Semua aman"}
          icon={<Clock3 size={19} />}
        />
        <StatTile label="Waspada / risiko" value={String(insight.stats.risky)} accent="yellow" tone="text-amber-600" icon={<ShieldAlert size={19} />} />
        <StatTile label="Siap diambil" value={String(insight.stats.readyToPickup)} accent="teal" tone="text-teal-700" icon={<PackageCheck size={19} />} />
        <StatTile label="Nilai order aktif" value={formatRupiah(insight.stats.revenueActive)} accent="blue" tone="text-sky-700" icon={<CircleDollarSign size={19} />} />
        <StatTile label="DP / terbayar" value={formatRupiah(insight.stats.paidAmount)} accent="teal" tone="text-teal-700" icon={<Banknote size={19} />} />
      </section>

      {/* RINGKASAN AI — promo band dengan foto hasil produksi */}
      <AiSummaryBand summary={summary.summary} source={summary.source} highlights={insight.highlights} actions={insight.actions} />

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title flex items-center gap-2"><Flame size={20} className="text-amber-500" /> Prioritas AI: urutan kerja</h2>
            <Link href="/pesanan" className="inline-flex items-center gap-1 text-xs font-extrabold text-teal-700 hover:underline">Lihat semua <ArrowRight size={13} /></Link>
          </div>
          {insight.insights.length === 0 ? (
            <div className="card flex flex-col items-center p-10 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><FolderOpen size={32} /></span>
              <p className="mt-4 text-sm font-extrabold text-[#07384f]">Belum ada pekerjaan aktif</p>
              <p className="mt-1 text-xs text-slate-500">Tambahkan pekerjaan pertama, AI akan langsung memantau statusnya.</p>
              <Link href="/pesanan/baru" className="btn-primary mt-4"><Plus size={16} /> Buat Pekerjaan Baru</Link>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {insight.insights.slice(0, 6).map((item) => (
                <InsightCard
                  key={item.orderId}
                  insight={item}
                  photoCount={photoMap.get(item.orderId) ?? 0}
                  outsource={outsourceMap.get(item.orderId)}
                  dueDate={orderById.get(item.orderId)?.dueDate ?? ""}
                  dueTime={orderById.get(item.orderId)?.dueTime ?? ""}
                />
              ))}
            </div>
          )}

          <div className="card p-5">
            <div className="flex items-center gap-3">
              <span className="icon-tile"><Workflow size={18} /></span>
              <div><h3 className="text-sm font-extrabold text-[#07384f]">Posisi pekerjaan per tahap</h3><p className="text-xs text-slate-500">Klik tahap untuk melihat daftar pekerjaannya.</p></div>
            </div>
            <ul className="mt-5 space-y-3">
              {STATUSES.map((status) => {
                const count = counts.get(status.key) ?? 0;
                return (
                  <li key={status.key}>
                    <Link href={`/pesanan?status=${status.key}`} className="group block">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-600 group-hover:text-teal-700">
                        <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${status.dot}`} />{status.label}</span>
                        <span className="font-extrabold">{count}</span>
                      </div>
                      <div className="mt-1.5"><ProgressBar value={(count / maxCount) * 100} tone={status.bar} /></div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <AiAssistant />
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <span className="icon-tile"><Workflow size={18} /></span>
              <div><h3 className="text-sm font-extrabold text-[#07384f]">Cara kerja monitoring AI</h3><p className="text-[11px] text-slate-400">Empat langkah sederhana</p></div>
            </div>
            <ol className="mt-4 space-y-3 text-xs leading-relaxed text-slate-600">
              {[
                ["Masukkan pekerjaan", "Isi pelanggan, jenis cetak, jumlah, deadline, dan harga."],
                ["Update setiap tahap", "Antrian → desain → cetak → finishing → QC → siap."],
                ["AI menghitung risiko", "Sisa pekerjaan dibandingkan dengan sisa waktu."],
                ["Anda fokus memutuskan", "Kerjakan yang paling berisiko dan kabari pelanggan."],
              ].map(([title, desc], i) => (
                <li key={title} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-teal-50 font-extrabold text-teal-700">{i + 1}</span><span><strong className="text-slate-800">{title}.</strong> {desc}</span></li>
              ))}
            </ol>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-500">
              <strong>Skor risiko:</strong> <span className="font-bold text-teal-600">0–34 aman</span> · <span className="font-bold text-amber-600">35–64 waspada</span> · <span className="font-bold text-orange-600">65–89 berisiko</span> · <span className="font-bold text-rose-600">90–100 terlambat</span>
            </div>
          </div>
        </section>
      </div>

      {insight.stats.finishingToday > 0 ? (
        <section className="card p-5">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#07384f]"><Clock3 size={18} className="text-amber-500" /> Deadline hari ini</h3>
          <ul className="mt-3 divide-y divide-slate-100">
            {orders.filter((o) => o.dueDate === new Date().toISOString().slice(0, 10)).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <Link href={`/pesanan/${o.id}`} className="font-bold text-slate-700 hover:text-teal-700">{o.code} — {o.title}</Link>
                <span className="chip border-teal-100 bg-teal-50 text-teal-700">{statusMeta(o.status).short} · {o.dueTime}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
