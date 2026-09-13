import type { ReactNode } from "react";
import { ArrowUpRight, Building2, Lightbulb, ShieldCheck, UserRound } from "lucide-react";
import { RISK_META, type OrderInsight, type RiskLevel } from "@/lib/ai";
import { priorityMeta, statusMeta } from "@/lib/domain";
import { PhotoQuickPeek } from "@/components/PhotoQuickPeek";

export function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return <span className={`chip ${meta.badge}`}>{meta.short}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const meta = priorityMeta(priority);
  return <span className={`chip ${meta.badge}`}>{meta.label}</span>;
}

export function RiskBadge({ level, score }: { level: RiskLevel; score?: number }) {
  const meta = RISK_META[level];
  return (
    <span className={`chip ${meta.badge}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
      {typeof score === "number" ? <span className="opacity-60">· {Math.round(score)}</span> : null}
    </span>
  );
}

export function ProgressBar({ value, tone = "bg-teal-500" }: { value: number; tone?: string }) {
  return (
    <div className="progress-track">
      <div className={`h-full rounded-full ${tone} transition-all duration-500`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "text-[#07384f]",
  icon,
  accent = "teal",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  icon?: ReactNode;
  accent?: "teal" | "yellow" | "rose" | "blue";
}) {
  const tiles = {
    teal: "bg-teal-50 text-teal-700",
    yellow: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    blue: "bg-sky-50 text-sky-600",
  };
  return (
    <div className="card group relative overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,75,84,.11)]">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-teal-400 to-amber-300 opacity-0 transition group-hover:opacity-100" />
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tiles[accent]}`}>{icon}</div>
      <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[.09em] text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black tracking-tight ${tone}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] font-medium text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function InsightCard({
  insight,
  photoCount = 0,
  outsource,
}: {
  insight: OrderInsight;
  photoCount?: number;
  outsource?: { status: string; partnerName: string };
}) {
  const meta = statusMeta(insight.status);
  return (
    <div className="card group relative overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_12px_30px_rgba(15,75,84,.1)]">
      <div className={`absolute inset-y-0 left-0 w-1 ${meta.bar}`} />
      <div className="flex flex-wrap items-start justify-between gap-2 pl-1">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-teal-700">
            {insight.code}
            <PhotoQuickPeek orderId={insight.orderId} code={insight.code} count={photoCount} />
          </p>
          <p className="mt-0.5 truncate text-sm font-extrabold text-[#07384f]">{insight.title}</p>
          <p className="text-xs text-slate-500">{insight.customerName}</p>
          <p className={`mt-1 flex items-center gap-1 text-[11px] font-bold ${insight.operator ? "text-teal-700" : "text-amber-600"}`}>
            <UserRound size={11} /> PIC: {insight.operator || "Belum ditentukan"}
          </p>
          {outsource ? (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">
              <Building2 size={10} /> Mitra: {outsource.partnerName}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={insight.status} />
          <RiskBadge level={insight.riskLevel} score={insight.riskScore} />
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-700">{insight.headline}</p>
      <div className="mt-2"><ProgressBar value={insight.progress} tone={meta.bar} /></div>
      <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-slate-500">
        {insight.reasons.slice(0, 2).map((reason) => (
          <li key={reason} className="flex gap-1.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-400" /><span>{reason}</span></li>
        ))}
      </ul>
      {insight.recommendations[0] ? (
        <div className="mt-3 flex gap-2 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-900">
          <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <span>{insight.recommendations[0]}</span>
        </div>
      ) : null}
      <a href={`/pesanan/${insight.orderId}`} className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-teal-700 hover:underline">
        Buka detail <ArrowUpRight size={13} />
      </a>
    </div>
  );
}

export function SafeIcon() {
  return <ShieldCheck size={18} />;
}
