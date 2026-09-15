"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LogIn, ShieldAlert, Image as ImageIcon, Repeat, GitCommitHorizontal } from "lucide-react";
import { formatDateTimeID } from "@/lib/domain";
import type { AuditEntry } from "@/lib/audit-queries";

const TYPE_META: Record<AuditEntry["type"], { label: string; icon: React.ReactNode; tone: string }> = {
  login_ok: { label: "Login", icon: <LogIn size={14} />, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  login_gagal: { label: "Login Gagal", icon: <ShieldAlert size={14} />, tone: "text-rose-700 bg-rose-50 border-rose-200" },
  status: { label: "Status", icon: <GitCommitHorizontal size={14} />, tone: "text-teal-700 bg-teal-50 border-teal-200" },
  mutasi: { label: "Mutasi", icon: <Repeat size={14} />, tone: "text-amber-700 bg-amber-50 border-amber-200" },
  foto: { label: "Foto", icon: <ImageIcon size={14} />, tone: "text-sky-700 bg-sky-50 border-sky-200" },
};

export function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<AuditEntry["type"] | "semua">("semua");

  const actors = useMemo(() => Array.from(new Set(entries.map((e) => e.actor))).sort(), [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (typeFilter !== "semua" && e.type !== typeFilter) return false;
      if (query && !e.actor.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [entries, query, typeFilter]);

  return (
    <div className="space-y-3">
      <div className="card space-y-3 p-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTypeFilter("semua")}
            className={`chip border ${typeFilter === "semua" ? "border-slate-700 bg-slate-800 text-white dark:border-slate-300 dark:bg-slate-200 dark:text-slate-900" : "border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-[#0c1c27] dark:text-slate-300"}`}
          >
            Semua
          </button>
          {(Object.keys(TYPE_META) as AuditEntry["type"][]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`chip border ${typeFilter === t ? TYPE_META[t].tone : "border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-[#0c1c27] dark:text-slate-400"}`}
            >
              {TYPE_META[t].icon} {TYPE_META[t].label}
            </button>
          ))}
        </div>
        <input
          list="audit-actor-list"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama / username…"
          className="input"
        />
        <datalist id="audit-actor-list">
          {actors.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        <p className="text-[11px] text-slate-500">
          Menampilkan {filtered.length} dari {entries.length} aktivitas terakhir.
        </p>
      </div>

      <div className="card divide-y divide-slate-100 dark:divide-white/5">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Tidak ada aktivitas yang cocok.</p>
        ) : (
          filtered.slice(0, 200).map((e) => (
            <div key={e.id} className="flex items-start gap-3 p-3">
              <span className={`chip mt-0.5 shrink-0 border ${TYPE_META[e.type].tone}`}>{TYPE_META[e.type].icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{e.actor}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {e.detail}
                  {e.orderCode && e.orderId ? (
                    <>
                      {" · "}
                      <Link href={`/pesanan/${e.orderId}`} className="font-semibold text-teal-700 hover:underline dark:text-teal-300">
                        {e.orderCode}
                      </Link>
                    </>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">{formatDateTimeID(e.createdAt)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
