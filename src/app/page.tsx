import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Flame,
  FolderOpen,
  Lightbulb,
  ListTodo,
  PackageCheck,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Workflow,
} from "lucide-react";
import { AiAssistant } from "@/components/AiAssistant";
import { BrandMark } from "@/components/BrandMark";
import { LocalDateTime } from "@/components/LocalDateTime";
import { ProblemScreen } from "@/components/ProblemScreen";
import { InsightCard, KpiCard, ProgressBar } from "@/components/ui";
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

  const orders = result.data.rows;
  const photoMap = result.data.counts;
  const outsourceMap = result.data.outsourced;
  // Ringkasan dashboard dihitung lokal agar halaman tidak menunggu API GPT/Claude.
  // Model bahasa tetap dipakai on-demand melalui panel Tanya AI.
  const insight = buildDashboardInsight(orders);
  const summary = { summary: insight.summary, source: "engine" };
  const counts = new Map<string, number>();
  for (const order of orders) counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
  const maxCount = Math.max(1, ...STATUSES.map((s) => counts.get(s.key) ?? 0));

  return (
    <div className="space-y-5">
      {/* HERO MODERN YELLOW–TEAL */}
      <section className="relative isolate overflow-hidden rounded-[1.35rem] border border-teal-400/20 bg-[#07384f] p-5 text-white shadow-[0_18px_45px_rgba(7,56,79,.18)] md:p-7">
        <div className="absolute -right-20 -top-32 -z-10 h-96 w-96 rounded-full border-[70px] border-teal-400/10" />
        <div className="absolute -bottom-32 right-24 -z-10 h-72 w-72 rounded-full bg-teal-400/10 blur-2xl" />
        <div className="absolute -bottom-20 -right-16 -z-10 h-44 w-44 rotate-12 rounded-[2rem] bg-amber-300" />
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(130deg,rgba(20,184,166,.38),transparent_45%,rgba(8,145,178,.2))]" />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-amber-300">
              <LocalDateTime />
            </p>
            <div className="mt-2 flex items-center gap-3">
              <h1 className="text-2xl font-black leading-tight tracking-tight md:text-4xl">Kondisi Percetakan Hari Ini</h1>
              <BrandMark compact />
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cyan-50/80">
              Pantau status produksi, sisa waktu, dan risiko keterlambatan dalam satu tampilan yang ringkas.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Link
              href="/pesanan/baru"
              className="btn-primary min-w-0 whitespace-nowrap px-2 py-2.5 text-[11px] sm:px-4 sm:text-sm"
            >
              <Plus size={15} strokeWidth={2.7} className="shrink-0 sm:h-[17px] sm:w-[17px]" />
              <span>Pekerjaan Baru</span>
            </Link>
            <Link
              href="/pesanan"
              className="btn min-w-0 whitespace-nowrap border border-white/30 bg-white/10 px-2 py-2.5 text-[11px] text-white hover:bg-white/15 sm:px-4 sm:text-sm"
            >
              <ListTodo size={15} className="shrink-0 sm:h-[17px] sm:w-[17px]" />
              <span>Semua Pekerjaan</span>
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-teal-300/35 bg-[#07556a]/65 p-4 shadow-inner backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10">
                <Sparkles size={18} className="text-amber-300" />
              </span>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.08em] text-white">Ringkasan AI</p>
                <p className="text-[10px] text-cyan-100/70">Analisis produksi terkini</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/30 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-cyan-50">
              <RefreshCw size={11} /> Update otomatis {summary.source !== "engine" ? `· ${summary.source}` : ""}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-relaxed text-white">{summary.summary}</p>
          <ul className="mt-3 grid gap-2 text-xs text-cyan-50/80 md:grid-cols-2">
            {insight.highlights.slice(0, 6).map((h) => (
              <li key={h} className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-teal-300" /><span>{h}</span></li>
            ))}
          </ul>
          {insight.actions.length ? (
            <div className="mt-4 rounded-xl border-l-4 border-amber-400 bg-white/95 p-3 text-[#1e293b] shadow-sm">
              <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-[#0f766e]">
                <Lightbulb size={14} /> Tindakan yang disarankan hari ini
              </p>
              <ul className="mt-1.5 space-y-1 text-xs font-medium">
                {insight.actions.slice(0, 5).map((a) => (
                  <li key={a} className="flex gap-1.5"><ArrowRight size={13} className="mt-0.5 shrink-0 text-amber-500" /><span>{a}</span></li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      {/* KPI */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Pekerjaan aktif" value={String(insight.stats.totalActive)} icon={<ClipboardList size={18} />} />
        <KpiCard label="Terlambat" value={String(insight.stats.late)} tone={insight.stats.late > 0 ? "text-rose-600" : "text-teal-700"} icon={<Clock3 size={18} />} accent={insight.stats.late > 0 ? "rose" : "teal"} hint={insight.stats.late > 0 ? "Perlu tindakan" : "Semua aman"} />
        <KpiCard label="Waspada / risiko" value={String(insight.stats.risky)} tone="text-amber-600" icon={<ShieldAlert size={18} />} accent="yellow" />
        <KpiCard label="Siap diambil" value={String(insight.stats.readyToPickup)} tone="text-teal-700" icon={<PackageCheck size={18} />} />
        <KpiCard label="Nilai order aktif" value={formatRupiah(insight.stats.revenueActive)} tone="text-sky-700" icon={<CircleDollarSign size={18} />} accent="blue" />
        <KpiCard label="DP / terbayar" value={formatRupiah(insight.stats.paidAmount)} tone="text-teal-700" icon={<Banknote size={18} />} />
      </section>

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
