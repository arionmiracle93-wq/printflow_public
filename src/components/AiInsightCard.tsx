import { ArrowRight, Bot, ChevronDown, History, Info } from "lucide-react";
import { RISK_META, type OrderInsight, type RiskLevel } from "@/lib/ai";
import { formatDateTimeID } from "@/lib/domain";

/**
 * KARTU "ANALISA AI" DI HALAMAN DETAIL PEKERJAAN
 * ---------------------------------------------------------------
 * Dulu: kepala kartu bergradasi teal ke ungu. Ungu tidak termasuk sistem
 * warna aplikasi, jadi kartu ini satu-satunya yang "lepas".
 *
 * Sekarang memakai gaya panel yang sama dengan panel dashboard: kepala
 * polos bergaris bawah, kotak ikon teal, dan badge risiko di kanan.
 * Warna hanya dipakai untuk arti (tingkat risiko), bukan hiasan.
 *
 * Teks dari mesin analisa (src/lib/ai.ts, tidak diubah) dirapikan saat
 * ditampilkan: emoji dibuang karena tingkat risiko sudah tampil sebagai
 * badge berwarna, dan tanda pisah panjang diganti koma.
 */

/** Hapus emoji dan tanda pisah panjang dari teks mesin analisa, hanya untuk tampilan. */
function tidy(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\uFE0F?/gu, "")
    .replace(/\s*[\u2014\u2013]\s*/g, ", ")
    .replace(/\s*\u2192\s*/g, " ke ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const RISK_TONE: Record<RiskLevel, { bar: string; text: string }> = {
  aman: { bar: "bg-[color:var(--pf-ok)]", text: "text-[color:var(--pf-ok)]" },
  waspada: { bar: "bg-[color:var(--pf-warn)]", text: "text-[color:var(--pf-warn)]" },
  risiko: { bar: "bg-[color:var(--pf-alert)]", text: "text-[color:var(--pf-alert)]" },
  terlambat: { bar: "bg-[color:var(--pf-danger)]", text: "text-[color:var(--pf-danger)]" },
};

const SCALE: { from: number; label: string; level: RiskLevel }[] = [
  { from: 0, label: "Aman", level: "aman" },
  { from: 35, label: "Waspada", level: "waspada" },
  { from: 65, label: "Berisiko", level: "risiko" },
  { from: 90, label: "Terlambat", level: "terlambat" },
];

export function AiInsightCard({
  insight,
  notes,
}: {
  insight: Pick<OrderInsight, "headline" | "riskScore" | "riskLevel" | "reasons" | "recommendations">;
  notes: { id: number; createdAt: Date | string; message: string }[];
}) {
  const meta = RISK_META[insight.riskLevel];
  const tone = RISK_TONE[insight.riskLevel];
  const score = Math.max(0, Math.min(100, Math.round(insight.riskScore)));

  return (
    <section className="card overflow-hidden">
      <header className="pf-panel-head">
        <span className="icon-tile h-8 w-8">
          <Bot size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="pf-panel-title">Analisa AI</h3>
          <p className="pf-panel-sub">Dari sisa pekerjaan, sisa waktu, dan prioritas</p>
        </div>
        <span className={`chip shrink-0 ${meta.badge}`}>{meta.label}</span>
      </header>

      <div className="space-y-4 p-4">
        <p className="text-sm font-semibold leading-snug text-[color:var(--pf-ink)]">{tidy(insight.headline)}</p>

        {/* Skor risiko: angka besar + bar + skala, supaya arti angkanya jelas. */}
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-[color:var(--pf-ink-3)]">Skor risiko</span>
            <span className="pf-num">
              <b className={`text-lg font-semibold ${tone.text}`}>{score}</b>
              <span className="text-xs text-[color:var(--pf-ink-3)]"> / 100</span>
            </span>
          </div>
          <div
            className="progress-track mt-1.5"
            role="meter"
            aria-label="Skor risiko"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={score}
          >
            <div className={`h-full rounded-full ${tone.bar} transition-[width] duration-500`} style={{ width: `${Math.max(3, score)}%` }} />
          </div>
          <div className="relative mt-1 h-4 text-[10px] text-[color:var(--pf-ink-3)]" aria-hidden>
            {SCALE.map((s) => (
              <span
                key={s.from}
                className={`absolute top-0 ${s.from === 0 ? "left-0" : "-translate-x-1/2"} ${
                  s.level === insight.riskLevel
                    ? `font-semibold ${tone.text}`
                    : ""
                }`}
                style={s.from === 0 ? undefined : { left: `${s.from}%` }}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {insight.reasons.length ? (
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--pf-ink-2)]">
              <Info size={13} className="text-[color:var(--pf-ink-3)]" /> Kenapa begitu?
            </h4>
            <ul className="mt-1.5 space-y-1.5">
              {insight.reasons.map((r) => (
                <li key={r} className="border-l-2 border-[color:var(--pf-line-strong)] pl-2.5 text-xs leading-relaxed text-[color:var(--pf-ink-2)]">
                  {tidy(r)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {insight.recommendations.length ? (
          <div className="rounded-xl bg-[color:var(--pf-accent-soft)] p-3">
            <h4 className="text-xs font-semibold text-[color:var(--pf-accent-strong)]">Saran tindakan</h4>
            <ul className="mt-1.5 space-y-1.5">
              {insight.recommendations.map((r) => (
                <li key={r} className="flex gap-2 text-xs leading-relaxed text-[color:var(--pf-ink)]">
                  <ArrowRight size={13} className="mt-0.5 shrink-0 text-[color:var(--pf-accent-strong)]" />
                  <span>{tidy(r)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Riwayat dilipat supaya kartu tetap ringkas; dibuka kalau perlu. */}
        {notes.length ? (
          <details className="group rounded-xl border border-[color:var(--pf-line)]">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-semibold text-[color:var(--pf-ink-2)] [&::-webkit-details-marker]:hidden">
              <History size={13} className="text-[color:var(--pf-ink-3)]" />
              Riwayat catatan AI
              <span className="pf-num font-normal text-[color:var(--pf-ink-3)]">({Math.min(notes.length, 5)})</span>
              <ChevronDown size={14} className="ml-auto text-[color:var(--pf-ink-3)] transition-transform group-open:rotate-180" />
            </summary>
            <ul className="space-y-2 border-t border-[color:var(--pf-line-soft)] px-3 py-2.5">
              {notes.slice(0, 5).map((n) => (
                <li key={n.id} className="text-[11px] leading-relaxed text-[color:var(--pf-ink-2)]">
                  <span className="pf-num block text-[10px] text-[color:var(--pf-ink-3)]">{formatDateTimeID(n.createdAt)}</span>
                  {tidy(n.message)}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </section>
  );
}
