import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, FolderPlus, ListChecks, PieChart, Workflow } from "lucide-react";
import { STATUSES, statusMeta } from "@/lib/domain";
import { STATUS_ICONS } from "@/components/ui";

/** Judul seksi. Tanpa label kecil huruf kapital di atasnya. */
export function SectionHeading({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="truncate text-[15px] font-semibold tracking-[-0.015em] text-[color:var(--pf-ink)]">{title}</h2>
        {meta ? <p className="mt-0.5 truncate text-xs text-[color:var(--pf-ink-3)]">{meta}</p> : null}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[color:var(--pf-accent-strong)] hover:underline"
        >
          {action.label} <ArrowRight size={13} />
        </Link>
      ) : null}
    </div>
  );
}

export function Panel({
  title,
  meta,
  icon,
  children,
  footer,
}: {
  title: string;
  meta?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="pf-surface overflow-hidden">
      <header className="pf-panel-head">
        {icon ? <span className="shrink-0 text-[color:var(--pf-ink-3)]">{icon}</span> : null}
        <div className="min-w-0">
          <h3 className="pf-panel-title truncate">{title}</h3>
          {meta ? <p className="pf-panel-sub truncate">{meta}</p> : null}
        </div>
      </header>
      {children}
      {footer}
    </section>
  );
}

/* =================================================================
   POSISI PEKERJAAN PER TAHAP
   Grid ubin, satu ubin per tahap produksi, bisa diketuk untuk
   membuka daftar pekerjaan di tahap itu. Warna ikon mengikuti
   status.dot di src/lib/domain.ts, jadi tetap sama dengan badge
   status di halaman lain. Ubin yang masih kosong dibuat lebih
   redup supaya tahap yang benar-benar berisi langsung menonjol.
   ================================================================= */
export function StagePositions({ counts }: { counts: Map<string, number> }) {
  const total = STATUSES.reduce((sum, s) => sum + (counts.get(s.key) ?? 0), 0);
  const max = Math.max(1, ...STATUSES.map((s) => counts.get(s.key) ?? 0));

  return (
    <section className="pf-surface overflow-hidden">
      <header className="flex items-center gap-3 border-b border-[color:var(--pf-line-soft)] px-4 py-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--pf-accent-soft)] text-[color:var(--pf-accent-strong)]">
          <Workflow size={18} />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold tracking-[-0.01em] text-[color:var(--pf-ink)]">
            Posisi pekerjaan per tahap
          </h3>
          <p className="truncate text-[11px] text-[color:var(--pf-ink-3)]">Ketuk satu tahap untuk melihat daftarnya</p>
        </div>
        <span className="pf-num ml-auto shrink-0 rounded-full border border-[color:var(--pf-line)] px-2.5 py-0.5 text-[11px] font-semibold text-[color:var(--pf-ink-2)]">
          {total} total
        </span>
      </header>

      <ul className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-3">
        {STATUSES.map((status) => {
          const count = counts.get(status.key) ?? 0;
          const Icon = STATUS_ICONS[status.key] ?? Workflow;
          const filled = count > 0;
          return (
            <li key={status.key} className="min-w-0">
              <Link href={`/pesanan?status=${status.key}`} className={`pf-stage-tile ${filled ? "pf-stage-tile-on" : ""}`}>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${status.dot} ${
                    filled ? "" : "opacity-75"
                  }`}
                >
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-[color:var(--pf-accent-strong)]">
                      {status.short}
                    </span>
                    <span className="pf-num shrink-0 text-sm font-semibold text-[color:var(--pf-ink)]">{count}</span>
                  </span>
                  <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--pf-surface-3)]">
                    <span
                      className={`block h-full rounded-full ${status.bar} transition-[width] duration-500`}
                      style={{ width: `${filled ? Math.max(6, (count / max) * 100) : 0}%` }}
                    />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* =================================================================
   SEBARAN RISIKO, DIAGRAM DONAT
   Empat irisan mengikuti skala skor risiko AI yang sudah ada:
   Aman 0-34, Waspada 35-64, Berisiko 65-89, Terlambat 90-100.
   Jumlah per level dihitung dari riskLevel tiap pekerjaan aktif
   (hasil analyzeOrder di src/lib/ai.ts), jadi angkanya selalu
   cocok dengan badge risiko di kartu pekerjaan.

   SVG polos tanpa pustaka grafik supaya ringan di WebView APK.
   Irisan digambar bertahap saat halaman dibuka, arahkan kursor ke
   irisan atau ke baris legenda untuk menyorot level tersebut.
   ================================================================= */
export type RiskCounts = { aman: number; waspada: number; risiko: number; terlambat: number };

const RISK_SLICES: { key: keyof RiskCounts; label: string; range: string; color: string }[] = [
  { key: "aman", label: "Aman", range: "0-34", color: "var(--pf-ok)" },
  { key: "waspada", label: "Waspada", range: "35-64", color: "var(--pf-warn)" },
  { key: "risiko", label: "Berisiko", range: "65-89", color: "var(--pf-alert)" },
  { key: "terlambat", label: "Terlambat", range: "90-100", color: "var(--pf-danger)" },
];

export function RiskDonut({ counts, averageScore }: { counts: RiskCounts; averageScore: number }) {
  const total = RISK_SLICES.reduce((sum, s) => sum + counts[s.key], 0);
  const R = 42;
  const C = 2 * Math.PI * R;
  const visible = RISK_SLICES.filter((s) => counts[s.key] > 0);
  const gap = visible.length > 1 ? 2.2 : 0;
  let drawn = 0;

  return (
    <Panel
      title="Sebaran risiko"
      meta={total > 0 ? `${total} pekerjaan aktif, skor rata-rata ${Math.round(averageScore)}` : "Belum ada pekerjaan aktif"}
      icon={<PieChart size={16} />}
    >
      {total === 0 ? (
        <p className="p-4 text-xs text-[color:var(--pf-ink-3)]">Diagram muncul setelah ada pekerjaan berjalan.</p>
      ) : (
        <div className="pf-donut flex items-center gap-5 p-4">
          <div className="relative h-[132px] w-[132px] shrink-0">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label="Diagram sebaran risiko pekerjaan aktif">
              <circle cx="60" cy="60" r={R} fill="none" strokeWidth="14" style={{ stroke: "var(--pf-surface-3)" }} />
              {visible.map((s, i) => {
                const len = (counts[s.key] / total) * C;
                const seg = Math.max(0.001, len - gap);
                const offset = -drawn;
                drawn += len;
                return (
                  <circle
                    key={s.key}
                    data-risk={s.key}
                    className="pf-donut-seg"
                    cx="60"
                    cy="60"
                    r={R}
                    fill="none"
                    strokeWidth="14"
                    strokeLinecap="butt"
                    strokeDasharray={`${seg} ${C - seg}`}
                    strokeDashoffset={offset}
                    style={{ stroke: s.color, ["--pf-seg" as string]: `${seg}`, ["--pf-c" as string]: `${C}`, animationDelay: `${i * 90}ms` }}
                  >
                    <title>{`${s.label}: ${counts[s.key]} pekerjaan`}</title>
                  </circle>
                );
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="pf-num text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-[color:var(--pf-ink)]">
                {total}
              </span>
              <span className="mt-1 text-[10px] font-medium text-[color:var(--pf-ink-3)]">aktif</span>
            </div>
          </div>

          <ul className="min-w-0 flex-1 space-y-1">
            {RISK_SLICES.map((s) => {
              const value = counts[s.key];
              const pct = Math.round((value / total) * 100);
              return (
                <li
                  key={s.key}
                  data-risk={s.key}
                  className={`pf-donut-row flex items-center gap-2.5 rounded-xl px-2 py-1.5 ${value === 0 ? "opacity-45" : ""}`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-[color:var(--pf-ink)]">{s.label}</span>
                    <span className="pf-num block text-[10px] text-[color:var(--pf-ink-3)]">skor {s.range}</span>
                  </span>
                  <span className="pf-num shrink-0 text-sm font-semibold" style={{ color: s.color }}>
                    {value}
                  </span>
                  <span className="pf-num w-9 shrink-0 text-right text-[11px] text-[color:var(--pf-ink-3)]">{pct}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Panel>
  );
}

/* =================================================================
   TINDAKAN
   ================================================================= */
export function ActionList({ actions }: { actions: string[] }) {
  if (!actions.length) return null;
  return (
    <Panel title="Perlu tindakan" meta={`${actions.length} saran dari analisa risiko`} icon={<ListChecks size={16} />}>
      <ol className="divide-y divide-[color:var(--pf-line-soft)]">
        {actions.map((a, i) => (
          <li key={a} className="flex gap-2.5 px-3.5 py-2.5">
            <span className="pf-num mt-px w-4 shrink-0 text-[11px] font-semibold text-[color:var(--pf-ink-3)]">
              {i + 1}
            </span>
            <span className="min-w-0 text-xs leading-relaxed text-[color:var(--pf-ink-2)]">{a}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/* =================================================================
   JATUH TEMPO HARI INI
   ================================================================= */
export function DueToday({
  orders,
}: {
  orders: { id: number; code: string; title: string; status: string; dueTime: string; customerName: string }[];
}) {
  if (!orders.length) return null;
  return (
    <Panel title="Jatuh tempo hari ini" meta={`${orders.length} pekerjaan`}>
      <ul className="divide-y divide-[color:var(--pf-line-soft)]">
        {orders.map((o) => (
          <li key={o.id}>
            <Link
              href={`/pesanan/${o.id}`}
              className="flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-[color:var(--pf-surface-2)]"
            >
              <span className="pf-mono w-11 shrink-0 text-xs font-semibold text-[color:var(--pf-ink)]">{o.dueTime}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-[color:var(--pf-ink)]">{o.title}</span>
                <span className="block truncate text-[11px] text-[color:var(--pf-ink-3)]">{o.customerName}</span>
              </span>
              <span className="pf-tag shrink-0">{statusMeta(o.status).short}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* =================================================================
   KEADAAN KOSONG
   ================================================================= */
export function EmptyQueue() {
  return (
    <div className="pf-surface flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--pf-accent-soft)] text-[color:var(--pf-accent-strong)]">
        <FolderPlus size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[color:var(--pf-ink)]">Belum ada pekerjaan aktif</p>
        <p className="mt-0.5 text-xs text-[color:var(--pf-ink-3)]">
          Begitu pekerjaan pertama masuk, urutan prioritas muncul di sini.
        </p>
      </div>
      <Link href="/pesanan/baru" className="pf-btn pf-btn-primary shrink-0">
        Pekerjaan baru
      </Link>
    </div>
  );
}
