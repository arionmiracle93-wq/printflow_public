import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, FolderPlus, ListChecks } from "lucide-react";
import { STATUSES, statusMeta } from "@/lib/domain";

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
   ALUR PRODUKSI
   Satu pita horizontal, lebar tiap ruas sebanding dengan jumlah
   pekerjaan di tahap itu. Versi lama memakai sembilan baris dengan
   bar berlatar penuh masing-masing, yang membuat pembaca harus
   membandingkan sembilan grafik kecil satu per satu. Pita tunggal
   menjawab pertanyaan sebenarnya: di tahap mana pekerjaan menumpuk.
   ================================================================= */
export function PipelineFlow({ counts, wide = false }: { counts: Map<string, number>; wide?: boolean }) {
  const stages = STATUSES.filter((s) => s.key !== "batal");
  const total = stages.reduce((sum, s) => sum + (counts.get(s.key) ?? 0), 0);

  return (
    <Panel title="Alur produksi" meta={total > 0 ? `${total} pekerjaan tercatat` : "Belum ada pekerjaan"}>
      <div className="p-3.5">
        {total === 0 ? (
          <p className="text-xs text-[color:var(--pf-ink-3)]">Pita alur muncul setelah ada pekerjaan masuk.</p>
        ) : (
          <div className="pf-flow" role="img" aria-label="Sebaran pekerjaan per tahap produksi">
            {stages.map((s) => {
              const count = counts.get(s.key) ?? 0;
              if (count === 0) return null;
              return (
                <span
                  key={s.key}
                  className={s.dot}
                  style={{ width: `${(count / total) * 100}%` }}
                  title={`${s.label}: ${count}`}
                />
              );
            })}
          </div>
        )}

        <ul className={`mt-3 grid grid-cols-2 gap-x-3 gap-y-0.5 ${wide ? "sm:grid-cols-4" : ""}`}>
          {stages.map((s) => {
            const count = counts.get(s.key) ?? 0;
            return (
              <li key={s.key}>
                <Link
                  href={`/pesanan?status=${s.key}`}
                  className={`flex items-center justify-between gap-2 rounded-[10px] px-1.5 py-1.5 transition-colors hover:bg-[color:var(--pf-surface-2)] ${
                    count === 0 ? "opacity-45" : ""
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={`h-2.5 w-1 shrink-0 rounded-full ${s.dot}`} />
                    <span className="truncate text-[11.5px] text-[color:var(--pf-ink-2)]">{s.short}</span>
                  </span>
                  <span className="pf-num shrink-0 text-xs font-semibold text-[color:var(--pf-ink)]">{count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}

/* =================================================================
   SEBARAN RISIKO
   Donat diganti pita bertumpuk. Untuk tiga kategori, pita lebih
   mudah dibandingkan daripada potongan lingkaran, dan ruang yang
   dihemat dipakai untuk angkanya.
   ================================================================= */
export function RiskSplit({ aman, waspada, terlambat }: { aman: number; waspada: number; terlambat: number }) {
  const total = aman + waspada + terlambat;
  const parts = [
    { key: "aman", label: "Aman", value: aman, bar: "bg-[color:var(--pf-ok)]", text: "text-[color:var(--pf-ok)]" },
    { key: "waspada", label: "Waspada", value: waspada, bar: "bg-[color:var(--pf-warn)]", text: "text-[color:var(--pf-warn)]" },
    { key: "telat", label: "Terlambat", value: terlambat, bar: "bg-[color:var(--pf-danger)]", text: "text-[color:var(--pf-danger)]" },
  ];

  return (
    <Panel title="Sebaran risiko" meta={total > 0 ? `${total} pekerjaan aktif` : "Belum ada pekerjaan aktif"}>
      <div className="p-3.5">
        {total === 0 ? (
          <p className="text-xs text-[color:var(--pf-ink-3)]">Grafik muncul setelah ada pekerjaan berjalan.</p>
        ) : (
          <>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--pf-surface-3)]">
              {parts.map((p) =>
                p.value > 0 ? (
                  <span key={p.key} className={p.bar} style={{ width: `${(p.value / total) * 100}%` }} />
                ) : null,
              )}
            </div>
            <ul className="mt-3 space-y-2">
              {parts.map((p) => (
                <li key={p.key} className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-[color:var(--pf-ink-2)]">{p.label}</span>
                  <span className="flex items-baseline gap-1.5">
                    <span className={`pf-num text-sm font-semibold ${p.text}`}>{p.value}</span>
                    <span className="pf-num text-[11px] text-[color:var(--pf-ink-3)]">
                      {Math.round((p.value / total) * 100)}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
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
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[color:var(--pf-accent-soft)] text-[color:var(--pf-accent-strong)]">
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
