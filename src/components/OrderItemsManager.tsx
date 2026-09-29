"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Building2, Check, CheckCircle2, ChevronDown, Loader2, Package, Pencil, Save } from "lucide-react";
import { OrderItemsEditor } from "@/components/OrderItemsEditor";
import { STATUSES, formatNumber, statusMeta } from "@/lib/domain";
import { effectiveItemStatus, isSplit } from "@/lib/item-status";
import { type OrderItem, type OrderItemInput } from "@/lib/order-items";

/**
 * KARTU "ITEM PEKERJAAN" di halaman detail.
 *
 * Menampilkan semua produk di dalam satu pekerjaan dan memungkinkan
 * pemilik menambah / mengubah / menghapus baris tanpa membuat pekerjaan baru.
 * Perubahan dikirim sebagai satu daftar utuh ke PUT /api/orders/[id]/items.
 *
 * Mode baca dipisah dari mode ubah supaya operator yang cuma ingin melihat
 * "hari ini harus cetak apa saja" tidak sengaja mengubah angka pesanan.
 */
export function OrderItemsManager({
  orderId,
  initialItems,
  orderStatus,
  jobs = [],
}: {
  orderId: number;
  initialItems: OrderItem[];
  /** Status pekerjaan saat ini, dipakai untuk produk yang "ikut pekerjaan". */
  orderStatus: string;
  /** Mitra pekerjaan ini, untuk menampilkan produk dikerjakan di mana. */
  jobs?: { id: number; partnerName: string }[];
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<OrderItem[]>(initialItems);
  const [draft, setDraft] = useState<OrderItemInput[]>(
    initialItems.map((i) => ({ id: i.id, productType: i.productType, quantity: i.quantity, unit: i.unit })),
  );
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageOk, setMessageOk] = useState(true);

  function startEdit() {
    // Selalu mulai dari data tersimpan terbaru, bukan sisa draft sebelumnya.
    setDraft(
      saved.length
        ? saved.map((i) => ({ id: i.id, productType: i.productType, quantity: i.quantity, unit: i.unit }))
        : [{ productType: "", quantity: 1, unit: "pcs" }],
    );
    setMessage(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setMessage(null);
  }

  async function save() {
    const bersih = draft.filter((i) => i.productType.trim());
    if (!bersih.length) {
      setMessageOk(false);
      setMessage("Minimal harus ada satu baris produk yang terisi.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: bersih }),
      });
      const json = (await res.json()) as { ok: boolean; data?: OrderItem[]; error?: string };
      if (!json.ok || !json.data) {
        setMessageOk(false);
        setMessage(json.error ?? "Gagal menyimpan item pekerjaan.");
        return;
      }
      setSaved(json.data);
      setEditing(false);
      setMessageOk(true);
      setMessage("Item pekerjaan tersimpan. Estimasi jam kerja ikut dihitung ulang.");
      router.refresh();
    } catch {
      setMessageOk(false);
      setMessage("Tidak dapat menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  const [busyItem, setBusyItem] = useState<number | null>(null);
  const multi = saved.length > 1;
  const split = isSplit(saved);

  /** Ubah tahap satu produk langsung dari tabel. */
  async function changeItemStatus(item: OrderItem, status: string) {
    setBusyItem(item.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, status }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; data?: { items: OrderItem[]; orderTo: string; orderFrom: string } };
      if (!json.ok || !json.data) {
        setMessageOk(false);
        setMessage(json.error ?? "Gagal memperbarui tahap produk.");
        return;
      }
      setSaved(json.data.items);
      setMessageOk(true);
      setMessage(
        json.data.orderTo !== json.data.orderFrom
          ? `${item.productType} ke ${statusMeta(status).short}. Status pekerjaan otomatis jadi ${statusMeta(json.data.orderTo).label}.`
          : `${item.productType} ke ${statusMeta(status).short}.`,
      );
      router.refresh();
    } catch {
      setMessageOk(false);
      setMessage("Tidak dapat menghubungi server.");
    } finally {
      setBusyItem(null);
    }
  }

  const totalUnit = saved.reduce((sum, i) => sum + (i.quantity || 0), 0);

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Package size={16} className="text-teal-600" /> Item Pekerjaan
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {saved.length} produk, total {formatNumber(totalUnit)} unit.{" "}
            {!multi
              ? "Satu status dan satu deadline."
              : split
                ? "Status pekerjaan otomatis mengikuti produk paling lambat."
                : "Semua produk masih ikut status pekerjaan. Ubah tahap salah satu produk untuk memisahkannya."}
          </p>
        </div>
        {!editing ? (
          <button type="button" onClick={startEdit} className="btn-ghost inline-flex shrink-0 items-center gap-1.5">
            <Pencil size={14} /> Ubah item
          </button>
        ) : null}
      </div>

      {!editing ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
          {saved.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-slate-500">
              Belum ada rincian produk. Klik &ldquo;Ubah item&rdquo; untuk menambahkan.
            </p>
          ) : (
            <>
              {/* HP: daftar bertumpuk. Tabel 5 kolom tidak muat di layar
                  sempit dan membuat pemilih tahap terjepit sampai teksnya
                  hilang, jadi di sini pemilih tahap mendapat baris sendiri
                  selebar kartu. */}
              <ul className="divide-y divide-slate-100 sm:hidden dark:divide-white/5">
                {saved.map((item, index) => (
                  <li key={item.id} className="px-3 py-3">
                    <div className="flex items-start gap-3">
                      <span className="pf-num mt-0.5 w-4 shrink-0 text-xs font-semibold text-slate-400">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold text-slate-800 dark:text-slate-100">{item.productType}</p>
                        <JobTag item={item} jobs={jobs} />
                      </div>
                      <p className="pf-num shrink-0 text-sm text-slate-600 dark:text-slate-300">
                        <b className="font-semibold text-slate-800 dark:text-slate-100">{formatNumber(item.quantity)}</b> {item.unit}
                      </p>
                    </div>
                    {multi ? (
                      <div className="mt-2 pl-7">
                        <StageSelect
                          item={item}
                          orderStatus={orderStatus}
                          busy={busyItem === item.id}
                          disabled={busyItem !== null}
                          onChange={(value) => changeItemStatus(item, value)}
                          wide
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>

              {/* Layar sm ke atas: tabel seperti biasa. */}
              <table className="hidden w-full text-left text-sm sm:table">
                <thead className="bg-slate-50 text-[11px] font-medium text-slate-500 dark:bg-white/[0.04]">
                  <tr>
                    <th className="w-10 px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Jenis produk</th>
                    <th className="px-3 py-2 text-right font-medium">Jumlah</th>
                    <th className="w-20 px-3 py-2 font-medium">Satuan</th>
                    {multi ? <th className="w-44 px-3 py-2 font-medium">Tahap</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {saved.map((item, index) => (
                    <tr key={item.id}>
                      <td className="pf-num px-3 py-2.5 text-xs font-semibold text-slate-400">{index + 1}</td>
                      <td className="px-3 py-2.5">
                        <span className="block font-semibold text-slate-800 dark:text-slate-200">{item.productType}</span>
                        <JobTag item={item} jobs={jobs} />
                      </td>
                      <td className="pf-num px-3 py-2.5 text-right font-semibold text-slate-800 dark:text-slate-200">
                        {formatNumber(item.quantity)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">{item.unit}</td>
                      {multi ? (
                        <td className="px-3 py-2">
                          <StageSelect
                            item={item}
                            orderStatus={orderStatus}
                            busy={busyItem === item.id}
                            disabled={busyItem !== null}
                            onChange={(value) => changeItemStatus(item, value)}
                          />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <OrderItemsEditor items={draft} onChange={setDraft} disabled={busy} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={busy} className="btn-primary">
              <Save size={15} /> {busy ? "Menyimpan…" : "Simpan item"}
            </button>
            <button type="button" onClick={cancelEdit} disabled={busy} className="btn-ghost">
              Batal
            </button>
          </div>
        </div>
      )}

      {message ? (
        <p
          className={`mt-3 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${
            messageOk
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
          }`}
        >
          {messageOk ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Nama mitra yang mengerjakan produk ini (kalau ada). */
function JobTag({ item, jobs }: { item: OrderItem; jobs: { id: number; partnerName: string }[] }) {
  const job = item.outsourceJobId ? jobs.find((j) => j.id === item.outsourceJobId) : undefined;
  if (!job) return null;
  return (
    <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
      <Building2 size={11} className="shrink-0" /> {job.partnerName}
    </span>
  );
}

/**
 * PEMILIH TAHAP PRODUK
 * ---------------------------------------------------------------
 * Tampil sebagai badge status berwarna (warna dari status.badge di
 * domain.ts). Produk yang masih ikut status pekerjaan diberi garis
 * putus-putus dan keterangan "ikut pekerjaan".
 *
 * Dua cara membuka daftar, dipilih otomatis sesuai perangkat:
 *
 * - Layar sentuh (HP, tablet): <select> bawaan. Android membuka daftar
 *   pilihan besar dari bawah layar yang sudah nyaman disentuh.
 *
 * - Mouse (desktop): panel pilihan buatan sendiri. Daftar bawaan
 *   browser di desktop tidak bisa diatur jarak dalam dan ukuran
 *   hurufnya (Chrome Windows mengabaikan padding pada <option>),
 *   sehingga teksnya menempel ke tepi. Panel ini memakai token tema,
 *   jadi rapi di mode terang dan gelap.
 *
 * Panel desktop tetap bisa dipakai penuh dengan keyboard: panah atas
 * dan bawah untuk berpindah, Enter atau Spasi untuk memilih, Home dan
 * End ke awal dan akhir, Escape atau Tab untuk menutup. Pola ARIA yang
 * dipakai: tombol dengan aria-haspopup="listbox" + role="listbox".
 */
function StageSelect({
  item,
  orderStatus,
  busy,
  disabled,
  onChange,
  wide = false,
}: {
  item: OrderItem;
  orderStatus: string;
  busy: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  const current = effectiveItemStatus(item.status, orderStatus);
  const meta = statusMeta(current);
  const following = !item.status;
  const finePointer = useFinePointer();

  const shell = `relative flex min-h-10 items-center gap-2 rounded-xl border px-3 text-[13px] font-semibold transition ${meta.badge} ${
    following ? "border-dashed" : ""
  } ${wide ? "w-full" : "w-full min-w-[9.5rem]"} ${disabled && !busy ? "opacity-60" : ""}`;

  const face = (
    <>
      <span className="min-w-0 flex-1 truncate text-left">
        {meta.short}
        {following ? <span className="ml-1.5 text-[11px] font-normal opacity-75">ikut pekerjaan</span> : null}
      </span>
      {busy ? <Loader2 size={15} className="shrink-0 animate-spin" /> : <ChevronDown size={15} className="shrink-0 opacity-70" />}
    </>
  );

  if (finePointer) {
    return (
      <StageListbox
        label={`Tahap ${item.productType}`}
        value={current}
        disabled={disabled}
        onChange={onChange}
        className={`${shell} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pf-accent)] focus-visible:ring-offset-1 disabled:cursor-not-allowed`}
      >
        {face}
      </StageListbox>
    );
  }

  return (
    <label
      className={`${shell} cursor-pointer focus-within:ring-2 focus-within:ring-[color:var(--pf-accent)] focus-within:ring-offset-1`}
    >
      <span className="sr-only">Tahap {item.productType}</span>
      {face}
      <select
        value={current}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        // Tidak terlihat (opacity-0), tapi latar dan teksnya tetap diisi
        // dari token supaya daftar bawaan yang terbuka ikut tema.
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-[color:var(--pf-surface-solid)] text-[color:var(--pf-ink)] opacity-0 disabled:cursor-not-allowed"
      >
        {STATUSES.map((st) => (
          <option key={st.key} value={st.key}>
            {st.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** true di perangkat dengan mouse / touchpad (desktop), false di layar sentuh. */
function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setFine(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return fine;
}

const POPUP_GAP = 6;
const POPUP_MAX_H = 320;

/** Panel pilihan tahap untuk desktop. Dirender di <body> supaya tidak terpotong kartu. */
function StageListbox({
  label,
  value,
  disabled,
  onChange,
  className,
  children,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  className: string;
  children: ReactNode;
}) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number }>({ left: 0, width: 0 });

  const selectedIndex = Math.max(0, STATUSES.findIndex((s) => s.key === value));

  function place() {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const width = Math.max(r.width, 224);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const below = window.innerHeight - r.bottom;
    // Buka ke atas kalau ruang di bawah tidak cukup dan di atas lebih lega.
    if (below < POPUP_MAX_H + POPUP_GAP && r.top > below) {
      setPos({ left, width, bottom: window.innerHeight - r.top + POPUP_GAP });
    } else {
      setPos({ left, width, top: r.bottom + POPUP_GAP });
    }
  }

  function openList() {
    if (disabled) return;
    place();
    setActive(selectedIndex);
    setOpen(true);
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function choose(index: number) {
    const target = STATUSES[index];
    close();
    if (target && target.key !== value) onChange(target.key);
  }

  // Saat terbuka: fokus ke daftar, tutup saat klik di luar, halaman digulir, atau ukuran jendela berubah.
  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!listRef.current?.contains(t) && !buttonRef.current?.contains(t)) close(false);
    };
    const onScroll = (e: Event) => {
      if (!listRef.current?.contains(e.target as Node)) close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  // Pilihan yang aktif selalu terlihat saat berpindah dengan keyboard.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onButtonKey(e: React.KeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  }

  function onListKey(e: React.KeyboardEvent) {
    const last = STATUSES.length - 1;
    if (e.key === "ArrowDown") setActive((a) => Math.min(last, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") {
      close(false);
      return;
    } else return;
    e.preventDefault();
  }

  const popup = open ? (
    <ul
      ref={listRef}
      id={`${id}-list`}
      role="listbox"
      aria-label={label}
      tabIndex={-1}
      aria-activedescendant={`${id}-opt-${active}`}
      onKeyDown={onListKey}
      style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: POPUP_MAX_H }}
      className="z-[120] overflow-y-auto rounded-xl border border-[color:var(--pf-line-strong)] bg-[color:var(--pf-surface-solid)] p-1.5 shadow-[var(--pf-shadow-3)] outline-none"
    >
      {STATUSES.map((st, index) => {
        const selected = st.key === value;
        return (
          <li
            key={st.key}
            id={`${id}-opt-${index}`}
            data-index={index}
            role="option"
            aria-selected={selected}
            onMouseEnter={() => setActive(index)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(index)}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-xs leading-tight transition-colors ${
              index === active ? "bg-[color:var(--pf-accent-soft)] text-[color:var(--pf-accent-strong)]" : "text-[color:var(--pf-ink-2)]"
            } ${selected ? "font-semibold text-[color:var(--pf-ink)]" : "font-medium"}`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`} aria-hidden />
            <span className="min-w-0 flex-1">{st.label}</span>
            {selected ? <Check size={14} className="shrink-0 text-[color:var(--pf-accent-strong)]" aria-hidden /> : null}
          </li>
        );
      })}
    </ul>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-label={`${label}: ${statusMeta(value).label}`}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onButtonKey}
        className={className}
      >
        {children}
      </button>
      {popup ? createPortal(popup, document.body) : null}
    </>
  );
}
