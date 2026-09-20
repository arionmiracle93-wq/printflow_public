import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Flame,
  FolderOpen,
  Lightbulb,
  ListTodo,
  PackageCheck,
  Plus,
  ShieldAlert,
  Sparkles,
  Workflow,
} from "lucide-react";
import { AiAssistant } from "@/components/AiAssistant";
import { BrandMark } from "@/components/BrandMark";
import { Greeting } from "@/components/Greeting";
import { HeroHighlightsCarousel } from "@/components/HeroHighlightsCarousel";
import { LocalDateTime } from "@/components/LocalDateTime";
import { ProblemScreen } from "@/components/ProblemScreen";
import { InsightCard, KpiCard, ProgressBar, STATUS_ICONS } from "@/components/ui";
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
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const counts = new Map<string, number>();
  for (const order of orders) counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
  const maxCount = Math.max(1, ...STATUSES.map((s) => counts.get(s.key) ?? 0));

  return (
    <div className="space-y-5">
      {/* HERO FOTO — kartu utama gaya "photo banner", terinspirasi referensi UI kedai kopi,
          disesuaikan untuk percetakan. Foto asli dipasang lewat /public/images/dashboard-hero.jpg
          (desktop) & dashboard-hero-mobile.jpg (HP) — dua file terpisah, boleh beda gambar;
          selama belum ada, lapisan gradasi + tekstur halftone di bawah ini tetap tampil rapi. */}
      <section className="relative isolate overflow-hidden rounded-[1.5rem] border border-white/10 text-white shadow-[0_20px_46px_rgba(3,16,23,.35)] dark:border-white/5 dark:shadow-[0_20px_46px_rgba(0,0,0,.5)]">
        {/* Foto latar + gradasi gelap. Strategi overlay beda mobile vs desktop — lihat .hero-photo-bg di globals.css */}
        <div className="hero-photo-bg absolute inset-0 -z-20" />
        {/* Aksen brand (amber + teal) tetap ada, kini jadi cahaya lembut di belakang foto */}
        <div className="absolute -bottom-24 -right-10 -z-10 h-56 w-56 rounded-full bg-amber-300/25 blur-3xl" />
        <div className="absolute -top-16 -left-10 -z-10 h-48 w-48 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="print-halftone absolute inset-0 -z-10 hidden md:block" />

        <div className="relative flex flex-col gap-4 p-5 [text-shadow:0_1px_10px_rgba(0,0,0,.55)] md:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                <Greeting /> <span aria-hidden>👋</span>
              </p>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.1em] text-white/50">
                <LocalDateTime />
              </p>
            </div>
            <BrandMark compact />
          </div>

          <div className="max-w-md">
            <h1 className="text-xl font-black leading-tight tracking-tight md:text-[1.75rem]">
              Produksi cetak, <span className="text-amber-300">terpantau</span> tepat waktu
            </h1>
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/70 md:text-sm">
              {summary.summary}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/pesanan/baru"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 py-2 text-[11px] font-extrabold text-[#07384f] shadow-[0_8px_18px_rgba(0,0,0,.28)] transition-transform active:scale-[0.97] sm:text-xs"
            >
              <Plus size={14} strokeWidth={2.8} className="shrink-0" /> Pekerjaan Baru <ArrowRight size={12} className="shrink-0" />
            </Link>
            <Link
              href="/pesanan"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:text-xs"
            >
              <ListTodo size={14} className="shrink-0" /> Semua Pekerjaan
            </Link>
          </div>

          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-300">
              <Sparkles size={10} /> Insight AI
            </span>
            <HeroHighlightsCarousel items={insight.highlights.slice(0, 5)} />
          </div>
        </div>
      </section>

      {insight.actions.length ? (
        <section className="panel-glass p-4 md:p-5">
          <div className="pointer-events-none absolute inset-0 -z-10 dark:bg-[linear-gradient(135deg,rgba(45,212,191,.28)_0%,rgba(56,189,248,.16)_50%,rgba(251,191,36,.14)_100%)]" />
          <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-teal-700 dark:text-teal-300">
            <Lightbulb size={14} /> Tindakan yang disarankan hari ini
          </p>
          <ul className="mt-2 space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            {insight.actions.slice(0, 5).map((a) => (
              <li key={a} className="flex gap-1.5">
                <ArrowRight size={13} className="mt-0.5 shrink-0 text-amber-500" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* KPI */}
      <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3 xl:grid-cols-6">
        <KpiCard label="Pekerjaan aktif" value={String(insight.stats.totalActive)} icon={<ClipboardList size={18} />} />
        <KpiCard label="Terlambat" value={String(insight.stats.late)} tone={insight.stats.late > 0 ? "text-rose-600" : "text-teal-700"} icon={<Clock3 size={18} />} accent={insight.stats.late > 0 ? "rose" : "teal"} hint={insight.stats.late > 0 ? "Perlu tindakan" : "Semua aman"} />
        <KpiCard label="Waspada / risiko" value={String(insight.stats.risky)} tone="text-amber-600" icon={<ShieldAlert size={18} />} accent="yellow" />
        <KpiCard label="Siap diambil" value={String(insight.stats.readyToPickup)} tone="text-teal-700" icon={<PackageCheck size={18} />} />
        <KpiCard label="Nilai order aktif" value={formatRupiah(insight.stats.revenueActive)} tone="text-sky-700" icon={<CircleDollarSign size={18} />} accent="blue" />
        <KpiCard label="DP / terbayar" value={formatRupiah(insight.stats.paidAmount)} tone="text-teal-700" icon={<Banknote size={18} />} />
      </section>

      <div className="relative isolate grid gap-5 lg:grid-cols-3">
        {/* Glow ambient lembut — nerusin identitas warna dari hero (teal+amber) supaya
            area konten utama ini nggak terasa hampa setelah lewat dari hero foto. */}
        <div className="pointer-events-none absolute -left-16 top-10 -z-10 h-64 w-64 rounded-full bg-teal-400/10 blur-3xl dark:bg-teal-400/[0.07]" />
        <div className="pointer-events-none absolute -right-10 bottom-0 -z-10 h-56 w-56 rounded-full bg-amber-300/10 blur-3xl dark:bg-amber-300/[0.04]" />
        <div className="pointer-events-none absolute -right-24 bottom-0 -z-10 h-80 w-80 rounded-full blur-3xl dark:bg-sky-400/[0.075]" />
        <section className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title flex items-center gap-2"><Flame size={20} className="text-amber-500" /> Prioritas AI: urutan kerja</h2>
            <Link href="/pesanan" className="inline-flex items-center gap-1 text-xs font-extrabold text-teal-700 hover:underline">Lihat semua <ArrowRight size={13} /></Link>
          </div>
          {insight.insights.length === 0 ? (
            <div className="panel-glass flex flex-col items-center p-10 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><FolderOpen size={32} /></span>
              <p className="mt-4 text-sm font-extrabold text-[#07384f]">Belum ada pekerjaan aktif</p>
              <p className="mt-1 text-xs text-slate-500">Tambahkan pekerjaan pertama, AI akan langsung memantau statusnya.</p>
              <Link href="/pesanan/baru" className="btn-primary mt-4"><Plus size={16} /> Buat Pekerjaan Baru</Link>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {(() => {
                const cards = insight.insights.slice(0, 6);
                return cards.map((item, idx) => {
                  const isLastOfOddCount = cards.length % 2 !== 0 && idx === cards.length - 1;
                  return (
                    <div key={item.orderId} className={isLastOfOddCount ? "md:col-span-2" : undefined}>
                      <InsightCard
                        insight={item}
                        photoCount={photoMap.get(item.orderId) ?? 0}
                        outsource={outsourceMap.get(item.orderId)}
                        dueDate={orderById.get(item.orderId)?.dueDate ?? ""}
                        dueTime={orderById.get(item.orderId)?.dueTime ?? ""}
                      />
                    </div>
                  );
                });
              })()}
            </div>
          )}

          <div className="panel-glass p-5">
            <div className="flex items-center gap-3">
              <span className="icon-tile"><Workflow size={18} /></span>
              <div><h3 className="text-sm font-extrabold text-[#07384f]">Posisi pekerjaan per tahap</h3><p className="text-xs text-slate-500">Klik tahap untuk melihat daftar pekerjaannya.</p></div>
            </div>
            <ul className="mt-5 space-y-1.5">
              {STATUSES.map((status) => {
                const count = counts.get(status.key) ?? 0;
                const StageIcon = STATUS_ICONS[status.key] ?? Workflow;
                return (
                  <li key={status.key}>
                    <Link
                      href={`/pesanan?status=${status.key}`}
                      className="group flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${status.dot}`}>
                        <StageIcon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-bold text-slate-700 group-hover:text-teal-700">{status.label}</span>
                          <span className={`chip shrink-0 ${status.badge}`}>{count}</span>
                        </div>
                        <div className="mt-1.5">
                          <ProgressBar value={(count / maxCount) * 100} tone={status.bar} />
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <AiAssistant />
          <div className="panel-glass p-5">
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
        <section className="panel-glass p-5">
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
