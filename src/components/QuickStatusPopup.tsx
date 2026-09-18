"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Building2, Loader2, X } from "lucide-react";
import { STATUSES, statusMeta } from "@/lib/domain";
import { OUTSOURCE_STATUSES, outsourceStatusMeta } from "@/lib/outsource";

type OutsourceFull = {
  id: number;
  partnerId: number | null;
  partnerName: string;
  status: string;
  vendorCost: number;
  expectedDate: string;
  expectedTime: string;
  notes: string | null;
  qcResult: string | null;
};

/**
 * Popup update cepat: ubah status global & status mitra tanpa pindah
 * halaman. Dipicu dari badge status di dashboard / list pekerjaan.
 */
export function QuickStatusPopup({
  orderId,
  orderCode,
  orderTitle,
  currentStatus,
  hasOutsource,
  trigger,
}: {
  orderId: number;
  orderCode: string;
  orderTitle: string;
  currentStatus: string;
  hasOutsource: boolean;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [outsource, setOutsource] = useState<OutsourceFull | null>(null);
  const [loadingOutsource, setLoadingOutsource] = useState(false);
  const [busyStatus, setBusyStatus] = useState<string | null>(null);
  const [busyOutsource, setBusyOutsource] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", escape);
    };
  }, [open]);

  function openPopup(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
    setMessage(null);
    if (hasOutsource && !outsource) {
      setLoadingOutsource(true);
      fetch(`/api/orders/${orderId}/outsource`)
        .then((r) => r.json())
        .then((json: { ok: boolean; data?: OutsourceFull | null }) => {
          setOutsource(json.ok && json.data ? json.data : null);
        })
        .catch(() => setOutsource(null))
        .finally(() => setLoadingOutsource(false));
    }
  }

  async function saveStatus(target: string) {
    if (target === status || busyStatus) return;
    if (target === "selesai" && outsource && outsource.status !== "diterima") {
      const label = outsourceStatusMeta(outsource.status).label;
      const ok = window.confirm(
        `Status produksi mitra untuk pekerjaan ini masih "${label}", belum "Diterima & Perlu QC".\n\nYakin mau tandai pekerjaan ini Selesai?`,
      );
      if (!ok) return;
    }
    setBusyStatus(target);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setMessage(json.error ?? "Gagal memperbarui status.");
        return;
      }
      setStatus(target);
      setMessage(`✅ Status diperbarui ke "${statusMeta(target).label}".`);
      router.refresh();
    } finally {
      setBusyStatus(null);
    }
  }

  async function saveOutsourceStatus(target: string) {
    if (!outsource || target === outsource.status || busyOutsource) return;
    setBusyOutsource(target);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/outsource`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...outsource, status: target }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setMessage(json.error ?? "Gagal memperbarui status mitra.");
        return;
      }
      setOutsource({ ...outsource, status: target });
      setMessage(`✅ Status mitra diperbarui ke "${outsourceStatusMeta(target).label}".`);
      router.refresh();
    } finally {
      setBusyOutsource(null);
    }
  }

  const modal = open ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Update status ${orderCode}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-[#021c29]/80 p-4 pt-8 backdrop-blur-[3px] sm:pt-10"
    >
      <div className="pop-in w-full max-w-lg overflow-hidden rounded-[1.35rem] border border-white/12 bg-white shadow-[0_28px_90px_-24px_rgba(0,0,0,.6)] dark:bg-[#101e29]">
        <div className="relative flex items-center justify-between gap-2 bg-[linear-gradient(115deg,#062f43,#07384f_55%,#0b5566)] px-4 py-3.5 text-white">
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(45,212,191,.6),transparent)]" />
          <div className="min-w-0">
            <p className="money text-[11px] font-black tracking-wide text-amber-300">{orderCode}</p>
            <p className="truncate text-[15px] font-extrabold leading-tight">{orderTitle}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-cyan-50/85">
              <span className={`h-1.5 w-1.5 rounded-full ${statusMeta(currentStatus).dot}`} />
              Status sekarang: {statusMeta(currentStatus).label}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
            aria-label="Tutup popup"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-extrabold uppercase tracking-[.09em] text-slate-500 dark:text-slate-400">Status Pekerjaan</p>
              <span className="money text-[10px] font-bold text-slate-400">
                {statusMeta(status).progress}% pada tahap ini
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {STATUSES.map((s) => {
                const chosen = status === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    disabled={busyStatus !== null}
                    onClick={() => saveStatus(s.key)}
                    aria-pressed={chosen}
                    className={`relative flex min-h-[46px] flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-1.5 text-[11px] font-extrabold transition-all active:scale-[.97] disabled:opacity-50 ${
                      chosen
                        ? "border-teal-500 bg-[linear-gradient(150deg,#f0fdfa,#ccfbf1)] text-teal-800 shadow-[0_6px_18px_-10px_rgba(13,148,136,.9)] dark:border-teal-400/70 dark:bg-teal-500/15 dark:text-teal-200"
                        : "border-slate-200 bg-white text-slate-600 hover:-translate-y-px hover:border-teal-300 hover:bg-teal-50/40 dark:border-white/10 dark:bg-[#0c1c27] dark:text-slate-300 dark:hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {busyStatus === s.key ? <Loader2 size={12} className="animate-spin" /> : <span aria-hidden="true">{s.emoji}</span>}
                      {s.short}
                    </span>
                    <span className={`h-1 w-8 overflow-hidden rounded-full ${chosen ? "bg-white/70" : "bg-slate-100 dark:bg-white/10"}`}>
                      <span className={`block h-full rounded-full ${s.bar}`} style={{ width: `${s.progress}%` }} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {hasOutsource ? (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Building2 size={13} /> Status Mitra{outsource ? ` — ${outsource.partnerName}` : ""}
              </p>
              {loadingOutsource ? (
                <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <Loader2 size={13} className="animate-spin" /> Memuat data mitra…
                </p>
              ) : outsource ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {OUTSOURCE_STATUSES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      title={s.label}
                      disabled={busyOutsource !== null}
                      onClick={() => saveOutsourceStatus(s.key)}
                      className={`rounded-xl border px-2 py-2 text-[11px] font-bold transition disabled:opacity-50 ${
                        outsource.status === s.key
                          ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-300"
                          : "border-slate-200 bg-white text-slate-600 hover:border-amber-300 dark:border-white/10 dark:bg-[#0c1c27] dark:text-slate-300"
                      }`}
                    >
                      {busyOutsource === s.key ? <Loader2 size={12} className="mx-auto animate-spin" /> : s.short}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Gagal memuat data mitra.</p>
              )}
            </div>
          ) : null}

          {message ? (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 dark:bg-white/5 dark:text-slate-200">{message}</p>
          ) : null}
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
          <a href={`/pesanan/${orderId}`} className="text-xs font-extrabold text-teal-700 hover:underline dark:text-teal-300">
            Buka halaman lengkap pekerjaan ini →
          </a>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <span onClick={openPopup} className="inline-flex cursor-pointer">
        {trigger}
      </span>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
