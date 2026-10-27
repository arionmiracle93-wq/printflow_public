import { formatRupiah } from "@/lib/domain";

/**
 * GRAFIK LAPORAN (gambar sendiri, tanpa library grafik).
 *
 * Semuanya SVG server-rendered: tidak ada state, tidak ada bundle JS
 * tambahan, dan gayanya mengikuti token tema (teal untuk aksen, sisanya
 * slate). Tooltip pakai <title> bawaan SVG - cukup untuk nilai angka.
 */

/** Format ringkas untuk garis skala Y: 250rb / 1,2jt / 0. */
export function compactRp(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    const juta = value / 1_000_000;
    const t = juta % 1 === 0 ? String(juta) : juta.toLocaleString("id-ID", { maximumFractionDigits: 1 });
    return `${t}jt`;
  }
  if (Math.abs(value) >= 1_000) {
    const rb = value / 1_000;
    const t = rb % 1 === 0 ? String(rb) : rb.toLocaleString("id-ID", { maximumFractionDigits: 1 });
    return `${t}rb`;
  }
  return String(Math.round(value));
}

/** Persen dengan satu desimal gaya Indonesia: 90,9 / 100 / 0. */
export function pctStr(x: number, of: number): string {
  if (!of) return "0";
  const p = (x / of) * 100;
  const r = Math.round(p * 10) / 10;
  return r.toLocaleString("id-ID", { maximumFractionDigits: 1 });
}

type Point = { x: number; y: number; value: number; title: string };

/** Lintasan mulus ala grafik SaaS: Catmull-Rom -> kurva bezier. */
function smoothPath(pts: Point[], open = true): string {
  if (!pts.length) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  if (open) return d;
  const last = pts[pts.length - 1];
  return `${d} L ${last.x.toFixed(1)} ${last.y.toFixed(1)} L ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} Z`;
}

/** Skala Y dengan langkah "bulat": langkah terkecil yang membuat <= 5 garis. */
function niceStep(max: number): { step: number; top: number } {
  const steps = [1_000, 2_000, 2_500, 5_000, 10_000, 20_000, 25_000, 50_000, 100_000, 200_000, 250_000, 500_000, 1_000_000, 2_000_000, 2_500_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000];
  const m = Math.max(1, max);
  const found = steps.find((s) => m / s <= 5);
  const step = found ?? Math.pow(10, Math.ceil(Math.log10(m)));
  return { step, top: step * Math.ceil(m / step) };
}

/* ==== TREN PENJUALAN (garis) =========================================== */

export type SeriesData = { label: string; values: { label: string; value: number; title: string }[] };

/**
 * Dua garis: periode aktif (teal penuh, diarsir) dan pembanding
 * (abu putus-putus, relatif lemah). `cmpSeries` null = tampilkan satu
 * garis saja (mode Tanpa Perbandingan).
 */
export function TrendChart({
  series,
  cmpSeries,
  showCmp,
  dailyMode = false,
}: {
  series: SeriesData;
  cmpSeries?: SeriesData | null;
  showCmp: boolean;
  dailyMode?: boolean;
}) {
  const W = 720;
  const H = 300;
  const padL = 50;
  const padR = 16;
  const padT = 18;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const n = series.values.length;

  if (dailyMode || n < 2) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 dark:border-slate-700">
        <span>
          {dailyMode
            ? "Mode Harian menampilkan satu hari saja. Pilih Bulanan atau Rentang untuk melihat tren harian."
            : "Belum cukup data untuk menggambar tren pada periode ini."}
        </span>
      </div>
    );
  }

  const maxVal = Math.max(
    1,
    ...series.values.map((v) => v.value),
    ...(showCmp && cmpSeries ? cmpSeries.values.map((v) => v.value) : [0]),
  );
  const { step, top } = niceStep(maxVal);
  const yTo = (v: number) => padT + plotH - (v / top) * plotH;
  const xTo = (i: number) => padL + (i / (n - 1)) * plotW;

  const curPts: Point[] = series.values.map((v, i) => ({
    x: xTo(i),
    y: yTo(v.value),
    value: v.value,
    title: v.title,
  }));

  /* Periode pembanding diselaraskan per urutan hari (bukan tanggal):
     hari ke-i pembanding digandeng dengan hari ke-i periode aktif. */
  const cmpPts: Point[] =
    showCmp && cmpSeries
      ? cmpSeries.values.slice(0, n).map((v, i) => ({ x: xTo(i), y: yTo(v.value), value: v.value, title: v.title }))
      : [];

  const gridCount = Math.round(top / step);
  const grid = Array.from({ length: gridCount + 1 }, (_, k) => step * k);

  const tickIdx = Array.from(new Set([0, Math.round((n - 1) * 0.25), Math.round((n - 1) * 0.5), Math.round((n - 1) * 0.75), n - 1]));
  const areaPath = `${smoothPath(curPts)} L ${curPts[n - 1].x.toFixed(1)} ${H - padB} L ${curPts[0].x.toFixed(1)} ${H - padB} Z`;

  const peak = curPts.reduce((a, b) => (b.value > a.value ? b : a), curPts[0]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Grafik tren penjualan">
      <defs>
        <linearGradient id="pf-trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--pf-accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--pf-accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* garis pinggir & grid titik-titik */}
      {grid.map((g, k) => {
        const y = yTo(g);
        return (
          <g key={k}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" strokeDasharray={g === 0 ? undefined : "2 4"} />
            <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10.5" fill="currentColor" className="text-slate-400 dark:text-slate-500">
              {compactRp(g)}
            </text>
          </g>
        );
      })}

      {showCmp && cmpPts.length > 1 ? (
        <>
          <path d={smoothPath(cmpPts)} fill="none" stroke="currentColor" className="text-slate-300 dark:text-slate-600" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
          {cmpPts.map((p, i) => (
            <circle key={`c${i}`} cx={p.x} cy={p.y} r="5.5" fill="transparent">
              <title>{`${p.title}: ${formatRupiah(p.value)}`}</title>
            </circle>
          ))}
        </>
      ) : null}

      <path d={areaPath} fill="url(#pf-trend-fill)" />
      <path d={smoothPath(curPts)} fill="none" stroke="currentColor" className="text-teal-500" strokeWidth="2.4" strokeLinecap="round" />

      {curPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="6" fill="transparent" className="cursor-default">
          <title>{`${p.title}: ${formatRupiah(p.value)}`}</title>
        </circle>
      ))}
      {peak.value > 0 ? (
        <g>
          <circle cx={peak.x} cy={peak.y} r="4.5" fill="currentColor" className="text-teal-600" stroke="var(--pf-surface)" strokeWidth="2" />
          <title>{`Tertinggi ${peak.title}: ${formatRupiah(peak.value)}`}</title>
        </g>
      ) : null}

      {tickIdx.map((i) => (
        <text key={i} x={xTo(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="currentColor" className="text-slate-400 dark:text-slate-500">
          {series.values[i]?.label}
        </text>
      ))}
    </svg>
  );
}

/* ==== DONAT DISTRIBUSI STATUS ========================================== */

/** Donat dua potongan (Lunas / Belum Dibayar) dengan jumlah di tengah. */
export function StatusDonut({ count, lunas }: { count: number; lunas: number }) {
  const belum = Math.max(0, count - lunas);
  const C = 2 * Math.PI * 56;
  const fracLunas = count ? Math.min(1, lunas / count) : 0;
  const dia = fracLunas * C;
  const diaBelum = C - dia;

  return (
    <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0" role="img" aria-label="Distribusi status pembayaran">
      <g transform="rotate(-90 80 80)">
        {count ? (
          <>
            <circle cx="80" cy="80" r="56" fill="none" stroke="currentColor" className="text-teal-600 dark:text-teal-500" strokeWidth="17" strokeDasharray={`${dia} ${C - dia}`} strokeDashoffset="0" />
            {diaBelum > 0.5 ? <circle cx="80" cy="80" r="56" fill="none" stroke="currentColor" className="text-teal-100 dark:text-teal-900/60" strokeWidth="17" strokeDasharray={`${diaBelum} ${C - diaBelum}`} strokeDashoffset={-dia} /> : null}
          </>
        ) : (
          <circle cx="80" cy="80" r="56" fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="17" />
        )}
      </g>
      <text x="80" y="74" textAnchor="middle" fontSize="27" fontWeight="800" fill="currentColor" className="text-[color:var(--pf-ink)]">
        {count}
      </text>
      <text x="80" y="93" textAnchor="middle" fontSize="10.5" fill="currentColor" className="text-slate-400">
        Invoice
      </text>
    </svg>
  );
}

/** Baris legenda: titik warna + label + jumlah (persen). */
export function DonutLegendItem({ dotClass, label, count, pct }: { dotClass: string; label: string; count: number; pct: string }) {
  return (
    <li className="flex items-center gap-2 text-[13px]">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[color:var(--pf-ink-2)]">{label}</span>
      <span className="font-bold text-[color:var(--pf-ink)]">{count}</span>
      <span className="w-14 shrink-0 text-right text-slate-400">({pct}%)</span>
    </li>
  );
}
