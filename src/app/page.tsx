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
  Handshake,
  Lightbulb,
  ListTodo,
  PackageCheck,
  Plus,
  ShieldAlert,
  Sparkles,
  Users,
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

/** Sapaan mengikuti jam WIB (sama seperti aturan jam di lib/domain.ts). */
function greetingWIB(now: Date): { label: string; icon: string } {
  const hour = Number(
    new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false }).format(now),
  );
  if (Number.isNaN(hour)) return { label: "Selamat bekerja", icon: "☀️" };
  if (hour >= 3 && hour < 11) return { label: "Selamat pagi", icon: "🌅" };
  if (hour >= 11 && hour < 15) return { label: "Selamat siang", icon: "☀️" };
  if (hour >= 15 && hour < 18) return { label: "Selamat sore", icon: "🌤️" };
  if (hour >= 18 && hour < 23) return { label: "Selamat malam", icon: "🌙" };
  return { label: "Lembar kerja malam", icon: "🌌" };
}

const QUICK_LINKS = [
  { href: "/pesanan", label: "Semua Pekerjaan", icon: ListTodo },
  { href: "/pelanggan", label: "Pelanggan", icon: Users },
  { href: "/serah-terima", label: "Serah Terima Shift", icon: Handshake },
  { href: "/mitra", label: "Produksi Mitra", icon: Workflow },
];

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
  const now = new Date();
  const greeting = greetingWIB(now);
  const todayISO = new Date().toISOString().slice(0, 10);
  const dueToday = orders.filter((o) => o.dueDate === todayISO && o.status !== "selesai" && o.status !== "batal");

  return (
    <div className="space-y-5">
      {/* ============================ HERO ============================ */}
      <section className="relative isolate overflow-hidden rounded-[1.4rem] border border-teal-400/20 bg-[#07384f] text-white shadow-[0_22px_60px_-28px_rgba(2,26,36,.9)]">
        <div aria-hidden="true" className="absolute inset-0 -z-20 bg-[linear-gradient(125deg,rgba(20,184,166,.42),transparent_46%,rgba(8,145,178,.24))]" />
        <div aria-hidden="true" className="absolute -right-16 -top-28 -z-10 h-80 w-80 rounded-full border-[64px] border-teal-300/10" />
        <div aria-hidden="true" className="absolute -bottom-24 right-28 -z-10 h-64 w-64 rounded-full bg-teal-300/10 blur-2xl" />
        <div aria-hidden="true" className="absolute -bottom-20 -right-10 -z-10 h-36 w-36 rotate-12 rounded-[2rem] bg-amber-300/90 opacity-70" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(251,191,36,.7),transparent)]" />

        <div className="p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/12 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[.1em] text-amber-200">
                <LocalDateTime />
              </p>
              <div className="mt-3 flex items-center gap-3">
                <BrandMark compact />
                <div className="min-w-0">
                  <h1 className="text-[22px] font-black leading-tight tracking-tight md:text-4xl">
                    {greeting.icon} Kondisi Percetakan Hari Ini
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-cyan-50/80">
                    {greeting.label} — sisa waktu, tahap kerja, dan risiko keterlambatan diringkas dalam satu tampilan.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
              <Link href="/pesanan/baru" className="btn-primary min-w-0 whitespace-nowrap px-3 py-2.5 text-[12px] sm:px-4 sm:text-sm">
                <Plus size={16} strokeWidth={3} className="shrink-0" />
                <span>Pekerjaan Baru</span>
              </Link>
              {QUICK_LINKS.map((q) => {
                const Icon = q.icon;
                return (
                  <Link
                    key={q.href}
                    href={q.href}
                    prefetch
                    className="btn min-w-0 whitespace-nowrap border border-white/25 bg-white/10 px-3 py-2.5 text-[12px] text-white hover:bg-white/[0.18] sm:px-4 sm:text-sm"
                  >
                    <Icon size={15} className="shrink-0" />
                    <span className="truncate">{q.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Ringkasan AI */}
          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-teal-300/30 bg-[#084055]/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/15">
                    <Sparkles size={18} className="text-amber-300" />
                  </span>
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[.08em] text-white">Ringkasan Harian</p>
                    <p className="text-[10px] text-cyan-100/70">Dihitung lokal — terbuka instan, tanpa menunggu API</p>
                  </div>
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-cyan-50">
                  {summary.source === "engine" ? "Mesin risiko Print Flow" : `Sumber: ${summary.source}`}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-relaxed text-white">{summary.summary}</p>
              <ul className="mt-3 grid gap-1.5 text-xs text-cyan-50/85 sm:grid-cols-2">
                {insight.highlights.slice(0, 6).map((h) => (
                  <li key={h} className="flex gap-2">
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-teal-300" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              {insight.actions.length ? (
                <div className="flex-1 rounded-2xl border-l-4 border-amber-400 bg-white/96 p-4 text-[#1e293b] shadow-[0_14px_36px_-22px_rgba(0,0,0,.7)]">
                  <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-[#0f766e]">
                    <Lightbulb size={14} className="text-amber-500" /> Saran tindakan hari ini
                  </p>
                  <ol className="mt-2 space-y-1.5 text-xs font-medium">
                    {insight.actions.slice(0, 5).map((a, i) => (
                      <li key={a} className="flex gap-2">
                        <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-[#07384f]">
                          {i + 1}
                        </span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Aktif", value: insight.stats.totalActive, tone: "text-white" },
                  { label: "Telat", value: insight.stats.late, tone: insight.stats.late > 0 ? "text-rose-300" : "text-white" },
                  { label: "Siap ambil", value: insight.stats.readyToPickup, tone: "text-teal-200" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/12 bg-white/[0.07] px-2 py-2 text-center">
                    <p className={`money text-lg font-black leading-none ${s.tone}`}>{s.value}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-cyan-100/65">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ KPI ============================ */}
      <section aria-label="Angka penting hari ini" className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3 xl:grid-cols-6">
        <KpiCard label="Pekerjaan aktif" value={String(insight.stats.totalActive)} icon={<ClipboardList size={18} />} trailing={<Link href="/pesanan?scope=aktif" className="text-[10px] font-extrabold text-teal-600 hover:underline dark:text-teal-300">Lihat</Link>} />
        <KpiCard label="Terlambat" value={String(insight.stats.late)} tone={insight.stats.late > 0 ? "text-rose-600 dark:text-rose-300" : "text-teal-700 dark:text-teal-300"} icon={<Clock3 size={18} />} accent={insight.stats.late > 0 ? "rose" : "teal"} hint={insight.stats.late > 0 ? "Perlu tindakan hari ini" : "Semua deadline aman"} />
        <KpiCard label="Waspada / risiko" value={String(insight.stats.risky)} tone="text-amber-600 dark:text-amber-300" icon={<ShieldAlert size={18} />} accent="yellow" hint="Kunci approval desain" />
        <KpiCard label="Siap diambil" value={String(insight.stats.readyToPickup)} tone="text-teal-700 dark:text-teal-300" icon={<PackageCheck size={18} />} hint="Kabari pelanggan" />
        <KpiCard label="Nilai order aktif" value={formatRupiah(insight.stats.revenueActive)} tone="text-sky-700 dark:text-sky-300" icon={<CircleDollarSign size={18} />} accent="blue" />
        <KpiCard label="DP / terbayar" value={formatRupiah(insight.stats.paidAmount)} tone="text-teal-700 dark:text-teal-300" icon={<Banknote size={18} />} hint={insight.stats.revenueActive > 0 ? `${Math.round((insight.stats.paidAmount / insight.stats.revenueActive) * 100)}% dari nilai order` : "Belum ada order aktif"} />
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[linear-gradient(150deg,#fbbf24,#f59e0b)] text-[#07384f] shadow-[0_6px_16px_-8px_rgba(245,158,11,.9)]">
                <Flame size={17} />
              </span>
              Urutan kerja disarankan
            </h2>
            <Link href="/pesanan" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold text-teal-700 transition hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-white/[0.06]">
              Lihat semua <ArrowRight size={13} />
            </Link>
          </div>

          {insight.insights.length === 0 ? (
            <div className="card flex flex-col items-center px-5 py-12 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(150deg,#ccfbf1,#f0fdfa)] text-teal-600 shadow-[0_14px_30px_-18px_rgba(13,148,136,.8)]">
                <FolderOpen size={32} />
              </span>
              <p className="mt-4 text-base font-extrabold text-[#07384f] dark:text-slate-100">Belum ada pekerjaan aktif</p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                Tambahkan pekerjaan pertama, lalu ubah statusnya tiap tahap. Risiko keterlambatan dihitung otomatis.
              </p>
              <Link href="/pesanan/baru" className="btn-primary mt-5">
                <Plus size={16} /> Buat Pekerjaan Baru
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {insight.insights.slice(0, 6).map((item, index) => (
                <div key={item.orderId} className="relative rise-in" style={{ animationDelay: `${index * 45}ms` }}>
                  <span className="pointer-events-none absolute -left-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/70 bg-[#07384f] text-[9px] font-black text-amber-300 shadow-[0_3px_10px_rgba(2,26,36,.45)]">
                    {index + 1}
                  </span>
                  <InsightCard
                    insight={item}
                    photoCount={photoMap.get(item.orderId) ?? 0}
                    outsource={outsourceMap.get(item.orderId)}
                    dueDate={orderById.get(item.orderId)?.dueDate ?? ""}
                    dueTime={orderById.get(item.orderId)?.dueTime ?? ""}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <div className="flex items-center gap-3">
              <span className="icon-tile"><Workflow size={18} /></span>
              <div>
                <h3 className="text-sm font-extrabold text-[#07384f] dark:text-slate-100">Sebaran pekerjaan per tahap</h3>
                <p className="text-xs text-slate-500">Klik tahap untuk melihat daftar pekerjaannya.</p>
              </div>
            </div>
            <ul className="mt-4 grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
              {STATUSES.map((status) => {
                const count = counts.get(status.key) ?? 0;
                return (
                  <li key={status.key}>
                    <Link href={`/pesanan?status=${status.key}`} className="group block rounded-xl px-1.5 py-1 transition hover:bg-teal-50/70 dark:hover:bg-white/[0.05]">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${status.dot}`} />
                          <span className="truncate">{status.short}</span>
                        </span>
                        <span className="money shrink-0 tabular-nums">
                          <span className="text-[13px] font-black text-[#07384f] group-hover:text-teal-700 dark:text-slate-100">{count}</span>
                          <span className="text-slate-400"> · {Math.round((count / maxCount) * 100)}%</span>
                        </span>
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

          {dueToday.length > 0 ? (
            <div className="card overflow-hidden !p-0">
              <h3 className="flex items-center justify-between gap-2 border-b border-amber-200/70 bg-[linear-gradient(100deg,#fffbeb,#fef3c7)] px-4 py-3 text-sm font-extrabold text-[#07384f]">
                <span className="flex items-center gap-2">
                  <Clock3 size={17} className="text-amber-500" /> Deadline hari ini
                </span>
                <span className="money rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-[#07384f]">{dueToday.length}</span>
              </h3>
              <ul className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {dueToday.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm transition hover:bg-slate-50 dark:hover:bg-white/[0.04]">
                    <Link href={`/pesanan/${o.id}`} className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-slate-700 hover:text-teal-700 dark:text-slate-200">{o.title}</span>
                      <span className="money text-[10px] font-extrabold text-teal-600 dark:text-teal-300">{o.code} · {o.dueTime}</span>
                    </Link>
                    <span className="chip shrink-0 border-teal-100 bg-teal-50 text-teal-700">{statusMeta(o.status).short}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="card">
            <div className="flex items-center gap-3">
              <span className="icon-tile"><ShieldAlert size={18} /></span>
              <div>
                <h3 className="text-sm font-extrabold text-[#07384f] dark:text-slate-100">Cara kerja monitoring</h3>
                <p className="text-[11px] text-slate-400">Empat langkah sederhana</p>
              </div>
            </div>
            <ol className="mt-4 space-y-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {[
                ["Masukkan pekerjaan", "Isi pelanggan, jenis cetak, jumlah, deadline, dan harga."],
                ["Update setiap tahap", "Antrian → desain → cetak → finishing → QC → siap."],
                ["Sistem menghitung risiko", "Sisa pekerjaan dibandingkan dengan sisa waktu."],
                ["Anda fokus memutuskan", "Kerjakan yang paling berisiko dan kabari pelanggan."],
              ].map(([title, desc], i) => (
                <li key={title} className="flex gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(150deg,#0d9488,#0f766e)] text-[11px] font-black text-white">{i + 1}</span>
                  <span><strong className="font-extrabold text-slate-800 dark:text-slate-100">{title}.</strong> {desc}</span>
                </li>
              ))}
            </ol>
            <div className="money mt-4 rounded-xl bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-500 dark:bg-white/[0.05]">
              <strong className="font-extrabold">Skor risiko:</strong>{" "}
              <span className="font-bold text-teal-600 dark:text-teal-300">0–34 aman</span> ·{" "}
              <span className="font-bold text-amber-600 dark:text-amber-300">35–64 waspada</span> ·{" "}
              <span className="font-bold text-orange-600 dark:text-orange-300">65–89 berisiko</span> ·{" "}
              <span className="font-bold text-rose-600 dark:text-rose-300">90–100 terlambat</span>
            </div>
          </div>
        </section>
      </div>

      {insight.stats.finishingToday > 0 ? (
        <section className="card flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-[#07384f] dark:text-slate-100">
            <PackageCheck size={16} className="mr-1 inline text-teal-600 dark:text-teal-300" />
            {insight.stats.finishingToday} pekerjaan masuk tahap finishing hari ini — jangan lupa QC sebelum diserahkan.
          </p>
          <Link href="/pesanan?status=finishing" className="btn-ghost btn-sm">
            Buka daftar finishing <ArrowRight size={13} />
          </Link>
        </section>
      ) : null}
    </div>
  );
}


