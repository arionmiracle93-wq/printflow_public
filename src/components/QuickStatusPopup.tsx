"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, CheckCircle2, Layers, Loader2, X } from "lucide-react";
import { STATUSES, statusMeta } from "@/lib/domain";
import { effectiveItemStatus, nextItemStatus } from "@/lib/item-status";
import { OUTSOURCE_STATUSES, outsourceStatusMeta } from "@/lib/outsource";
import type { OrderItem } from "@/lib/order-items";

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
  itemIds: number[];
};

/**
 * POPUP UPDATE CEPAT
 * ---------------------------------------------------------------
 * Dipicu dari badge status di dashboard, daftar pekerjaan, dan detail.
 * Tetap satu pintu masuk yang sudah biasa dipakai karyawan.
 *
 * Pekerjaan 1 produk: tampilannya sama seperti dulu (9 tombol status).
 *
 * Pekerjaan beberapa produk: di atas ada daftar produk. Tiap produk
 * punya SATU tombol besar "ke tahap berikutnya", karena itu yang paling
 * sering dilakukan (Cetak ke Finishing, dst). Tahap lain tetap bisa
 * dipilih lewat pilihan kecil di sebelahnya. Di bawahnya ada 9 tombol
 * yang mengubah SEMUA produk sekaligus.
 *
 * Status pekerjaan dihitung otomatis dari produk paling lambat, jadi
 * karyawan tidak perlu memikirkan status pekerjaan sama sekali.
 *
 * Beberapa mitra: tiap mitra tampil sendiri dengan produk yang
 * dikerjakannya.
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
  const [items, setItems] = useState<OrderItem[] | null>(null);
  const [jobs, setJobs] = useState<OutsourceFull[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<ReactNode | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => setStatus(currentStatus), [currentStatus]);

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

  function load() {
    setLoading(true);
    const tasks: Promise<void>[] = [
      fetch(`/api/orders/${orderId}/items`)
        .then((r) => r.json())
        .then((json: { ok: boolean; data?: OrderItem[] }) => setItems(json.ok && json.data ? json.data : []))
        .catch(() => setItems([])),
    ];
    if (hasOutsource) {
      tasks.push(
        fetch(`/api/orders/${orderId}/outsource`)
          .then((r) => r.json())
          .then((json: { ok: boolean; jobs?: OutsourceFull[] }) => setJobs(json.ok && json.jobs ? json.jobs : []))
          .catch(() => setJobs([])),
      );
    }
    void Promise.all(tasks).finally(() => setLoading(false));
  }

  function openPopup(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
    setMessage(null);
    load();
  }

  function done(text: ReactNode) {
    setMessage(
      <span className="inline-flex items-center gap-1.5">
        <CheckCircle2 size={13} className="shrink-0 text-[color:var(--pf-ok)]" /> {text}
      </span>,
    );
    router.refresh();
  }

  function confirmMitraBeforeFinish(target: string) {
    if (target !== "selesai" || !jobs?.length) return true;
    const pending = jobs.filter((j) => j.status !== "diterima");
    if (!pending.length) return true;
    const list = pending.map((j) => `- ${j.partnerName}: ${outsourceStatusMeta(j.status).label}`).join("\n");
    return window.confirm(
      `Produksi mitra berikut belum "Diterima & Perlu QC":\n${list}\n\nYakin mau tandai Selesai?`,
    );
  }

  /** Ubah status SEMUA produk sekaligus (sama dengan tombol status biasa). */
  async function saveOrderStatus(target: string) {
    if (target === status || busy) return;
    if (!confirmMitraBeforeFinish(target)) return;
    setBusy(`order:${target}`);
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
      done(<>Status diperbarui ke &quot;{statusMeta(target).label}&quot;.</>);
      load();
    } finally {
      setBusy(null);
    }
  }

  /** Ubah status SATU produk. Status pekerjaan ikut dihitung ulang di server. */
  async function saveItemStatus(item: OrderItem, target: string) {
    if (busy) return;
    if (!confirmMitraBeforeFinish(target)) return;
    setBusy(`item:${item.id}`);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, status: target }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: { orderTo: string; orderFrom: string; items: OrderItem[] };
      };
      if (!json.ok || !json.data) {
        setMessage(json.error ?? "Gagal memperbarui status produk.");
        return;
      }
      setItems(json.data.items);
      setStatus(json.data.orderTo);
      done(
        json.data.orderTo !== json.data.orderFrom ? (
          <>
            {item.productType} ke {statusMeta(target).short}. Pekerjaan otomatis jadi &quot;
            {statusMeta(json.data.orderTo).label}&quot;.
          </>
        ) : (
          <>
            {item.productType} ke &quot;{statusMeta(target).label}&quot;.
          </>
        ),
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveJobStatus(job: OutsourceFull, target: string) {
    if (target === job.status || busy) return;
    setBusy(`job:${job.id}`);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/outsource`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...job, status: target }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setMessage(json.error ?? "Gagal memperbarui status mitra.");
        return;
      }
      setJobs((prev) => prev?.map((j) => (j.id === job.id ? { ...j, status: target } : j)) ?? prev);
      done(
        <>
          {job.partnerName}: &quot;{outsourceStatusMeta(target).label}&quot;.
        </>,
      );
    } finally {
      setBusy(null);
    }
  }

  const multi = (items?.length ?? 0) > 1;
  const itemName = (id: number) => items?.find((i) => i.id === id)?.productType;

  const modal = open ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Update status ${orderCode}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-[#021c29]/90 p-4 pt-10"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[color:var(--pf-line)] bg-[color:var(--pf-surface-solid)] shadow-[0_24px_80px_rgba(0,0,0,.35)]">
        <div className="flex items-center justify-between gap-2 bg-[#07384f] px-4 py-3 text-white">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-cyan-100/80">{orderCode}</p>
            <p className="truncate text-sm font-semibold">{orderTitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
            aria-label="Tutup popup"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[72vh] space-y-5 overflow-y-auto p-4">
          {loading && !items ? (
            <div className="space-y-2" aria-busy="true">
              <div className="pf-skel h-14 w-full" />
              <div className="pf-skel h-14 w-full" />
            </div>
          ) : null}

          {/* ---------- Per produk ---------- */}
          {multi && items ? (
            <section>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--pf-ink)]">
                  <Layers size={14} className="text-[color:var(--pf-ink-3)]" /> Per produk
                </h3>
                <p className="text-[11px] text-[color:var(--pf-ink-3)]">
                  Pekerjaan: <b className="font-semibold text-[color:var(--pf-ink)]">{statusMeta(status).short}</b>
                </p>
              </div>
              <ul className="space-y-2">
                {items.map((item) => {
                  const current = effectiveItemStatus(item.status, status);
                  const meta = statusMeta(current);
                  const next = nextItemStatus(current);
                  const job = jobs?.find((j) => j.id === item.outsourceJobId);
                  const rowBusy = busy === `item:${item.id}`;
                  return (
                    <li key={item.id} className="rounded-xl border border-[color:var(--pf-line)] bg-[color:var(--pf-surface-2)] p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-[color:var(--pf-ink)]">{item.productType}</p>
                          <p className="truncate text-[11px] text-[color:var(--pf-ink-3)]">
                            {item.quantity} {item.unit}
                            {job ? ` · di ${job.partnerName}` : ""}
                          </p>
                        </div>
                        <span className={`chip shrink-0 ${meta.badge}`}>{meta.short}</span>
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        {next ? (
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => saveItemStatus(item, next)}
                            className="btn-secondary min-h-9 flex-1 px-3 py-1.5 text-xs"
                          >
                            {rowBusy ? <Loader2 size={13} className="animate-spin" /> : null}
                            {statusMeta(next).short} <ArrowRight size={13} />
                          </button>
                        ) : current === "selesai" ? (
                          <span className="flex min-h-9 flex-1 items-center justify-center rounded-xl text-xs font-medium text-[color:var(--pf-ok)]">
                            <CheckCircle2 size={14} className="mr-1" /> Tuntas
                          </span>
                        ) : (
                          <span className="flex min-h-9 flex-1 items-center justify-center rounded-xl text-xs text-[color:var(--pf-ink-3)]">
                            Pilih tahap di samping
                          </span>
                        )}
                        <label className="sr-only" htmlFor={`st-${item.id}`}>
                          Pilih tahap lain untuk {item.productType}
                        </label>
                        <select
                          id={`st-${item.id}`}
                          value={current}
                          disabled={busy !== null}
                          onChange={(e) => saveItemStatus(item, e.target.value)}
                          className="input min-h-9 w-[7.5rem] shrink-0 py-1 text-xs"
                        >
                          {STATUSES.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.short}
                            </option>
                          ))}
                        </select>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {/* ---------- Semua produk / status pekerjaan ---------- */}
          {items ? (
            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-[color:var(--pf-ink)]">
                {multi ? "Semua produk sekaligus" : "Status pekerjaan"}
              </h3>
              <div className="grid grid-cols-3 gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => saveOrderStatus(s.key)}
                    aria-pressed={status === s.key}
                    className={`flex min-h-10 items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11.5px] font-semibold transition disabled:opacity-50 ${
                      status === s.key
                        ? "border-[color:var(--pf-accent)] bg-[color:var(--pf-accent-soft)] text-[color:var(--pf-accent-strong)]"
                        : "border-[color:var(--pf-line)] bg-[color:var(--pf-surface-solid)] text-[color:var(--pf-ink-2)] hover:border-[color:var(--pf-accent-line)]"
                    }`}
                  >
                    {busy === `order:${s.key}` ? <Loader2 size={12} className="animate-spin" /> : null}
                    {s.short}
                  </button>
                ))}
              </div>
              {multi ? (
                <p className="mt-1.5 text-[11px] text-[color:var(--pf-ink-3)]">
                  Produk yang sudah lebih maju tidak dimundurkan.
                </p>
              ) : null}
            </section>
          ) : null}

          {/* ---------- Mitra ---------- */}
          {hasOutsource ? (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--pf-ink)]">
                <Building2 size={14} className="text-[color:var(--pf-ink-3)]" />
                {jobs && jobs.length > 1 ? `Mitra (${jobs.length})` : "Status mitra"}
              </h3>
              {!jobs ? (
                <div className="pf-skel h-12 w-full" />
              ) : jobs.length === 0 ? (
                <p className="text-xs text-[color:var(--pf-ink-3)]">Gagal memuat data mitra.</p>
              ) : jobs.length === 1 ? (
                <>
                  <p className="mb-1.5 text-[11px] text-[color:var(--pf-ink-3)]">{jobs[0].partnerName}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {OUTSOURCE_STATUSES.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        title={s.label}
                        disabled={busy !== null}
                        onClick={() => saveJobStatus(jobs[0], s.key)}
                        aria-pressed={jobs[0].status === s.key}
                        className={`min-h-10 rounded-xl border px-2 py-2 text-[11.5px] font-semibold transition disabled:opacity-50 ${
                          jobs[0].status === s.key
                            ? "border-[color:var(--pf-warn)] bg-[color:var(--pf-warn-soft)] text-[color:var(--pf-warn)]"
                            : "border-[color:var(--pf-line)] bg-[color:var(--pf-surface-solid)] text-[color:var(--pf-ink-2)]"
                        }`}
                      >
                        {busy === `job:${jobs[0].id}` ? <Loader2 size={12} className="mx-auto animate-spin" /> : s.short}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <ul className="space-y-2">
                  {jobs.map((job) => {
                    const names = job.itemIds.map(itemName).filter(Boolean);
                    return (
                      <li key={job.id} className="flex items-center gap-2 rounded-xl border border-[color:var(--pf-line)] bg-[color:var(--pf-surface-2)] p-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-[color:var(--pf-ink)]">{job.partnerName}</p>
                          <p className="truncate text-[11px] text-[color:var(--pf-ink-3)]">
                            {names.length ? names.join(", ") : "Seluruh pekerjaan"}
                          </p>
                        </div>
                        <label className="sr-only" htmlFor={`job-${job.id}`}>
                          Status mitra {job.partnerName}
                        </label>
                        <select
                          id={`job-${job.id}`}
                          value={job.status}
                          disabled={busy !== null}
                          onChange={(e) => saveJobStatus(job, e.target.value)}
                          className="input min-h-9 w-[8.5rem] shrink-0 py-1 text-xs"
                        >
                          {OUTSOURCE_STATUSES.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.short}
                            </option>
                          ))}
                        </select>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null}

          {message ? (
            <p role="status" className="rounded-xl bg-[color:var(--pf-surface-2)] px-3 py-2 text-xs font-medium text-[color:var(--pf-ink-2)]">
              {message}
            </p>
          ) : null}
        </div>

        <div className="border-t border-[color:var(--pf-line-soft)] bg-[color:var(--pf-surface-2)] px-4 py-3">
          <a href={`/pesanan/${orderId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--pf-accent-strong)] hover:underline">
            Buka halaman lengkap pekerjaan ini <ArrowRight size={13} />
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
