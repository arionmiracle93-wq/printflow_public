"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, Bot, Building2, Camera, ClipboardList, Phone, Plus, Save, Truck, X } from "lucide-react";
import { DateFieldID } from "@/components/DateFieldID";
import { NewOrderPhotoPicker, type PendingPhoto } from "@/components/NewOrderPhotoPicker";
import { OrderItemsEditor } from "@/components/OrderItemsEditor";
import { estimateHoursForItems, formatRupiah, humanDuration } from "@/lib/domain";
import { MACHINES, PRIORITIES, PRODUCT_TYPES, UNITS } from "@/lib/domain";
import { summarizeItems, type OrderItemInput } from "@/lib/order-items";
import { OUTSOURCE_STATUSES, PARTNER_KINDS, partnerKindLabel } from "@/lib/outsource";

type CustomerOption = { id: number; name: string; phone: string | null };
type PartnerOption = { id: number; name: string; kind: string; phone: string | null; active: boolean };

const inputCls = "input";

/**
 * Form pekerjaan baru.
 *
 * Desktop (lg ke atas): dua kolom bersebelahan - KIRI data pekerjaan,
 * KANAN produksi mitra (lempar keluar) - dipisah garis vertikal tegas
 * supaya tidak tertukar. Mobile: satu kolom scroll biasa, dipisah
 * pembatas horizontal berlabel.
 *
 * Mitra (boleh lebih dari satu) dikirim SETELAH order berhasil dibuat,
 * karena butuh orderId dan id produk. Server menyimpan produk sesuai urutan
 * baris yang terisi, jadi baris ke-n di form = produk ke-n di respons.
 * Endpoint-nya sama dengan yang dipakai tab Mitra di halaman detail.
 */
export function NewOrderForm({
  customers,
  operatorSuggestions = [],
  partners: initialPartners = [],
}: {
  customers: CustomerOption[];
  operatorSuggestions?: string[];
  partners?: PartnerOption[];
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string>("__new");
  const [customerName, setCustomerName] = useState("");
  const [title, setTitle] = useState("");
  // Satu pekerjaan bisa berisi beberapa produk sekaligus. Dimulai dengan satu
  // baris kosong supaya pengguna langsung bisa mengetik tanpa klik tambah.
  const [items, setItems] = useState<OrderItemInput[]>([
    { productType: PRODUCT_TYPES[0], quantity: 1, unit: UNITS[0] },
  ]);
  const [machine, setMachine] = useState(MACHINES[0]);
  const [operator, setOperator] = useState("");
  const [priority, setPriority] = useState("normal");
  const [price, setPrice] = useState("0");
  const [paidAmount, setPaidAmount] = useState("0");
  const [dueDate, setDueDate] = useState(defaultDate(2));
  const [dueTime, setDueTime] = useState("17:00");
  const [notes, setNotes] = useState("");
  // Foto yang dipilih di form ini - belum terunggah, baru dikirim ke server
  // setelah pekerjaannya berhasil disimpan dan dapat orderId. Lihat submit().
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  // Teks progres yang tampil di tombol Simpan selagi foto diunggah satu per satu.
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  // --- Kolom kanan: produksi mitra ---
  const [useOutsource, setUseOutsource] = useState(false);
  const [partners, setPartners] = useState<PartnerOption[]>(initialPartners);
  // Bisa lebih dari satu mitra. Tiap mitra memegang produk tertentu
  // (disimpan sebagai posisi baris di tabel Item Pekerjaan).
  const [mitraList, setMitraList] = useState<MitraDraft[]>(() => [newMitraDraft(defaultDate(2), [0])]);
  const [addPartnerFor, setAddPartnerFor] = useState<number | null>(null);
  const [newPartner, setNewPartner] = useState({ name: "", kind: "vendor", phone: "", address: "" });
  const [partnerBusy, setPartnerBusy] = useState(false);

  // Estimasi jam kerja dihitung dari SEMUA produk di dalam pekerjaan ini,
  // bukan cuma satu jenis seperti versi sebelumnya.
  const itemsTerisi = useMemo(() => items.filter((i) => i.productType.trim()), [items]);
  const estimate = useMemo(() => estimateHoursForItems(itemsTerisi), [itemsTerisi]);

  const orderPrice = Math.max(0, Number(price) || 0);
  const totalCost = mitraList.reduce((sum, m) => sum + Math.max(0, Number(m.vendorCost) || 0), 0);
  const margin = orderPrice - totalCost;
  const marginPercent = orderPrice > 0 ? Math.round((margin / orderPrice) * 100) : 0;
  // Posisi baris produk yang sudah terisi (baris kosong diabaikan saat simpan).
  const filledRows = useMemo(
    () => items.map((item, index) => (item.productType.trim() ? index : -1)).filter((index) => index >= 0),
    [items],
  );
  const multiItem = filledRows.length > 1;
  const lateRisk = Boolean(useOutsource && dueDate && mitraList.some((m) => m.expectedDate && m.expectedDate >= dueDate));

  function patchMitra(key: number, patch: Partial<MitraDraft>) {
    setMitraList((list) => list.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  }

  /** Satu produk hanya bisa di satu mitra: mencentang di mitra ini melepasnya dari mitra lain. */
  function toggleMitraItem(key: number, row: number) {
    setMitraList((list) => {
      const target = list.find((m) => m.key === key);
      const on = !target?.rows.includes(row);
      return list.map((m) =>
        m.key === key
          ? { ...m, rows: on ? [...m.rows, row].sort((a, b) => a - b) : m.rows.filter((r) => r !== row) }
          : on
            ? { ...m, rows: m.rows.filter((r) => r !== row) }
            : m,
      );
    });
  }

  function addMitra() {
    const taken = new Set(mitraList.flatMap((m) => m.rows));
    const free = filledRows.filter((row) => !taken.has(row));
    setMitraList((list) => [...list, newMitraDraft(dueDate, free)]);
  }

  function removeMitra(key: number) {
    setMitraList((list) => (list.length > 1 ? list.filter((m) => m.key !== key) : list));
  }

  /**
   * Tabel produk berubah. Kalau ada baris yang DIHAPUS, posisi baris di
   * bawahnya bergeser naik, jadi pilihan produk tiap mitra ikut digeser
   * supaya tetap menunjuk produk yang sama. Baris yang tidak disentuh
   * tetap objek yang sama, sehingga baris yang hilang bisa dikenali.
   */
  function changeItems(next: OrderItemInput[]) {
    if (next.length < items.length) {
      let removed = items.findIndex((item, index) => next[index] !== item);
      if (removed === -1) removed = items.length - 1;
      setMitraList((list) =>
        list.map((m) => ({
          ...m,
          rows: m.rows.filter((r) => r !== removed).map((r) => (r > removed ? r - 1 : r)),
        })),
      );
    }
    // Baris baru ditambahkan saat hanya ada SATU mitra yang memegang semua
    // produk: produk baru ikut ke mitra itu (pekerjaan dilempar utuh).
    if (next.length > items.length && mitraList.length === 1 && filledRows.every((row) => mitraList[0].rows.includes(row))) {
      const added = next.map((_, index) => index).filter((index) => index >= items.length);
      setMitraList((list) => [{ ...list[0], rows: [...list[0].rows, ...added] }]);
    }
    setItems(next);
  }

  /** Deadline pelanggan berubah: target barang kembali ikut mundur, selama belum diubah manual. */
  function changeDueDate(value: string) {
    setDueDate(value);
    if (value) setMitraList((list) => list.map((m) => (m.expectedTouched ? m : { ...m, expectedDate: dayBefore(value) })));
  }

  function selectPartner(key: number, value: string) {
    const partner = partners.find((p) => String(p.id) === value);
    patchMitra(key, partner ? { partnerId: value, partnerName: partner.name } : { partnerId: value });
  }

  async function createNewPartner(key: number) {
    if (!newPartner.name.trim()) return;
    setPartnerBusy(true);
    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPartner),
      });
      const json = (await res.json()) as { ok: boolean; data?: PartnerOption; error?: string };
      if (json.ok && json.data) {
        const created = json.data;
        setPartners((p) => [...p, created]);
        patchMitra(key, { partnerId: String(created.id), partnerName: created.name });
        setAddPartnerFor(null);
        setNewPartner({ name: "", kind: "vendor", phone: "", address: "" });
      } else {
        setError(json.error ?? "Gagal menambah mitra.");
      }
    } finally {
      setPartnerBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const finalName = customerId === "__new" ? customerName : customers.find((c) => String(c.id) === customerId)?.name;
    if (!finalName || !title || !dueDate) {
      setError("Nama pelanggan, nama pekerjaan, dan deadline wajib diisi.");
      return;
    }
    if (!itemsTerisi.length) {
      setError("Isi minimal satu baris produk di tabel Item Pekerjaan (jenis + jumlah + satuan).");
      return;
    }
    // Validasi kolom kanan DULU supaya tidak terlanjur membuat order lalu gagal di tengah jalan.
    if (useOutsource) {
      const incomplete = mitraList.findIndex((m) => !m.partnerName.trim() || !m.expectedDate);
      if (incomplete !== -1) {
        setError(`Mitra ${incomplete + 1}: nama mitra dan target barang kembali wajib diisi (atau hapus / matikan panel mitra).`);
        return;
      }
      if (multiItem) {
        const empty = mitraList.findIndex((m) => !m.rows.some((row) => filledRows.includes(row)));
        if (empty !== -1) {
          setError(`Mitra ${empty + 1} (${mitraList[empty].partnerName || "tanpa nama"}): centang minimal satu produk yang dikerjakan.`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId === "__new" ? null : Number(customerId),
          customerName: finalName,
          title,
          items: itemsTerisi,
          machine,
          operator,
          priority,
          price: Number.parseInt(price || "0", 10),
          paidAmount: Number.parseInt(paidAmount || "0", 10),
          dueDate,
          dueTime,
          notes,
        }),
      });
      const json = (await res.json()) as { ok: boolean; data?: { id: number; items?: { id: number }[] }; error?: string };
      if (!json.ok || !json.data) {
        setError(json.error ?? "Gagal menyimpan.");
        return;
      }
      const orderId = json.data.id;
      const createdItems = json.data.items ?? [];

      // Foto yang sudah dipilih di kartu "4. Foto pekerjaan" diunggah SEKARANG,
      // baru bisa terjadi setelah orderId ada. Dilakukan SEBELUM langkah mitra
      // di bawah supaya fotonya tetap aman tersimpan walau bagian mitra gagal.
      if (pendingPhotos.length) {
        let gagal = 0;
        for (let i = 0; i < pendingPhotos.length; i += 1) {
          const photo = pendingPhotos[i];
          setStage(`Mengunggah foto ${i + 1}/${pendingPhotos.length}…`);
          try {
            const form = new FormData();
            form.append(
              "files",
              new File([photo.blob], `foto-${orderId}-${Date.now()}-${i}.jpg`, { type: photo.blob.type || "image/jpeg" }),
            );
            form.append("kind", photo.kind);
            if (photo.caption) form.append("caption", photo.caption);
            const resFoto = await fetch(`/api/orders/${orderId}/photos`, { method: "POST", body: form });
            const jsonFoto = (await resFoto.json()) as { ok: boolean };
            if (!jsonFoto.ok) gagal += 1;
          } catch {
            gagal += 1;
          }
        }
        setStage(null);
        if (gagal > 0) {
          // Pekerjaannya sendiri sudah AMAN tersimpan - jangan sampai owner
          // mengira semuanya gagal. Yang gagal tinggal diunggah ulang dari
          // halaman detail (kartu Foto Pekerjaan di sana sama persis).
          alert(
            `Pekerjaan berhasil disimpan, tapi ${gagal} dari ${pendingPhotos.length} foto gagal diunggah (koneksi terputus?). Silakan unggah ulang dari halaman detail pekerjaan.`,
          );
        }
      }

      if (useOutsource) {
        // Produk baru punya id setelah pekerjaan tersimpan. Server menyimpan
        // produk sesuai urutan baris terisi, jadi posisi baris ke-n = produk ke-n.
        const idByRow = new Map(filledRows.map((row, n) => [row, createdItems[n]?.id]));
        const failed: string[] = [];
        for (const [n, m] of mitraList.entries()) {
          setStage(`Menyimpan mitra ${n + 1}/${mitraList.length}…`);
          const itemIds = multiItem
            ? m.rows.map((row) => idByRow.get(row)).filter((id): id is number => typeof id === "number")
            : [];
          try {
            const res2 = await fetch(`/api/orders/${orderId}/outsource`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                partnerId: Number(m.partnerId) || null,
                partnerName: m.partnerName.trim(),
                status: m.status,
                vendorCost: Math.max(0, Number(m.vendorCost) || 0),
                expectedDate: m.expectedDate,
                expectedTime: m.expectedTime,
                notes: m.notes,
                itemIds,
              }),
            });
            const json2 = (await res2.json()) as { ok: boolean; error?: string };
            if (!json2.ok) failed.push(`${m.partnerName} (${json2.error ?? "kesalahan server"})`);
          } catch {
            failed.push(`${m.partnerName} (koneksi terputus)`);
          }
        }
        setStage(null);
        if (failed.length) {
          // Pekerjaannya sudah aman tersimpan, jangan sampai hilang. Kasih jalan lanjut.
          setSavedId(orderId);
          setError(`Pekerjaan berhasil disimpan, tapi mitra berikut gagal disimpan: ${failed.join(", ")}. Buka detail pekerjaan untuk melengkapinya.`);
          return;
        }
      }

      router.push(`/pesanan/${orderId}`);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setSaving(false);
      setStage(null);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,25rem)] lg:gap-7">
        {/* ══════════ KOLOM KIRI: DATA PEKERJAAN ══════════ */}
        <div className="min-w-0 space-y-4">
          <ColumnHeader
            icon={<ClipboardList size={17} />}
            tone="teal"
            step="Kolom 1"
            title="Data Pekerjaan"
            subtitle="Wajib diisi - ini yang dicatat sebagai order pelanggan."
          />

          <section className="card p-4 md:p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">1. Pelanggan</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">Pilih pelanggan lama / baru</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls}>
                  <option value="__new">➕ Pelanggan baru (ketik nama)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {customerId === "__new" ? (
                <div>
                  <label className="label">Nama pelanggan baru</label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Contoh: Toko Berkah Jaya"
                    className={inputCls}
                  />
                </div>
              ) : null}
              <div className="md:col-span-2">
                <label className="label">Nama pekerjaan</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Order Pak Budi - paket promosi toko"
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Beri nama yang mewakili seluruh pesanan. Rincian produknya diisi di kartu berikutnya.
                </p>
              </div>
            </div>
          </section>

          {/* ITEM PEKERJAAN - satu pekerjaan boleh berisi banyak produk.
              Status, mesin, operator, dan deadline tetap satu untuk
              keseluruhan pekerjaan (diatur di kartu ini juga, di bawah). */}
          <section className="card p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">2. Item pekerjaan</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Boleh lebih dari satu produk dalam satu pekerjaan. Contoh: Spanduk 2 pcs + Stiker 500 lembar + Kartu
                  nama 1 box - semuanya jalan bareng, satu status, satu kali kirim WA.
                </p>
              </div>
            </div>

            <div className="mt-3">
              <OrderItemsEditor items={items} onChange={changeItems} disabled={saving} />
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-white/10">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Berlaku untuk seluruh pekerjaan
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div>
                  <label className="label">Mesin / tahapan utama</label>
                  <select value={machine} onChange={(e) => setMachine(e.target.value)} className={inputCls}>
                    {MACHINES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Operator / penanggung jawab</label>
                  <input
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    list="operator-list"
                    placeholder="Boleh dikosongkan"
                    className={inputCls}
                  />
                  <datalist id="operator-list">
                    {operatorSuggestions.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="label">Prioritas</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
                    {PRIORITIES.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-teal-50 px-3 py-2 text-xs font-medium text-teal-800 dark:bg-teal-500/10 dark:text-teal-200">
              <Bot size={14} className="mt-0.5 shrink-0" />
              <span>
                AI memperkirakan pekerjaan ini butuh ± <strong>{estimate} jam kerja</strong> ({humanDuration(estimate)})
                untuk {itemsTerisi.length} produk{itemsTerisi.length ? `: ${summarizeItems(itemsTerisi, 3)}` : ""}. Angka
                ini dipakai untuk menghitung risiko telat.
              </span>
            </p>
          </section>

          <section className="card p-4 md:p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">3. Deadline &amp; harga</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="label">Tanggal harus jadi</label>
                <DateFieldID value={dueDate} onChange={changeDueDate} className={inputCls} required />
              </div>
              <div>
                <label className="label">Jam</label>
                <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="label">Total harga (Rp)</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="label">DP / sudah dibayar (Rp)</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2 xl:col-span-4">
                <label className="label">Catatan (finishing, bahan, desain dari pelanggan, dll)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} />
              </div>
            </div>
          </section>
        </div>

        {/* ══════════ PEMBATAS ══════════ */}
        {/* Desktop: garis vertikal penuh. Mobile: pembatas horizontal berlabel. */}
        <div
          aria-hidden="true"
          className="hidden w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent lg:block dark:via-white/15"
        />
        <div className="flex items-center gap-3 lg:hidden" aria-hidden="true">
          <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.1em] text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
            Bagian 2 · Opsional
          </span>
          <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
        </div>

        {/* ══════════ KOLOM KANAN: PRODUKSI MITRA ══════════ */}
        <div className="min-w-0 space-y-4">
          <ColumnHeader
            icon={<Truck size={17} />}
            tone="amber"
            step="Kolom 2 · opsional"
            title="Produksi Mitra"
            subtitle="Isi kalau pekerjaan ini dilempar ke percetakan lain / pusat."
          />

          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-3 md:p-4 dark:border-amber-500/25 dark:bg-amber-500/[0.06]">
            {/* Saklar aktif/nonaktif */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white/70 p-3 dark:bg-white/[0.04]">
              <input
                type="checkbox"
                checked={useOutsource}
                onChange={(e) => {
                  const on = e.target.checked;
                  setUseOutsource(on);
                  // Kasus paling umum: satu pekerjaan dilempar utuh ke satu mitra.
                  // Mitra pertama yang masih kosong otomatis memegang semua produk.
                  if (on) {
                    setMitraList((list) =>
                      list.length === 1 && !list[0].partnerName.trim() ? [{ ...list[0], rows: filledRows }] : list,
                    );
                  }
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[color:var(--pf-ink)] dark:text-slate-100">
                  Lempar pekerjaan ini ke mitra
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Catat mitra, biaya, dan target barang kembali sekarang juga. Bisa lebih dari satu mitra, masing-masing
                  untuk produk yang berbeda.
                </span>
              </span>
            </label>

            {!useOutsource ? (
              <p className="mt-3 rounded-xl border border-dashed border-amber-300/70 px-3 py-4 text-center text-xs font-medium text-amber-800/70 dark:border-amber-500/30 dark:text-amber-200/70">
                Dikerjakan sendiri di dalam? Biarkan saja kosong. Panel ini diabaikan saat menyimpan.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {mitraList.map((m, n) => {
                  const selected = partners.find((p) => String(p.id) === m.partnerId);
                  const k = m.key;
                  return (
                    <fieldset
                      key={k}
                      aria-label={mitraList.length > 1 ? `Mitra ${n + 1}` : "Mitra"}
                      className="rounded-xl border border-[color:var(--pf-line)] bg-[color:var(--pf-surface-solid)] p-3"
                    >
                      <div className="mb-2.5 flex items-center justify-between gap-2">
                        <p className="text-[13px] font-semibold text-[color:var(--pf-ink)]">
                          {mitraList.length > 1 ? `Mitra ${n + 1}` : "Mitra"}
                          {m.partnerName ? <span className="font-normal text-[color:var(--pf-ink-3)]">: {m.partnerName}</span> : null}
                        </p>
                        {mitraList.length > 1 ? (
                          <button type="button" onClick={() => removeMitra(k)} className="pf-icon-btn h-8 w-8" aria-label={`Hapus mitra ${n + 1}`}>
                            <X size={14} />
                          </button>
                        ) : null}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="label" htmlFor={`nm-pilih-${k}`}>Mitra / percetakan pusat</label>
                          <div className="flex gap-2">
                            <select id={`nm-pilih-${k}`} value={m.partnerId} onChange={(e) => selectPartner(k, e.target.value)} className="input">
                              <option value="">Pilih mitra atau ketik manual</option>
                              {partners
                                .filter((p) => p.active)
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} · {partnerKindLabel(p.kind)}
                                  </option>
                                ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setAddPartnerFor(addPartnerFor === k ? null : k)}
                              className="btn-ghost shrink-0 px-3"
                              aria-label="Tambah mitra baru ke daftar"
                            >
                              {addPartnerFor === k ? <X size={16} /> : <Plus size={16} />}
                            </button>
                          </div>
                        </div>

                        {addPartnerFor === k ? (
                          <div className="rounded-xl border border-[color:var(--pf-accent-line)] bg-[color:var(--pf-accent-soft)] p-3">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--pf-accent-strong)]">
                              <Building2 size={14} /> Tambah mitra baru ke daftar
                            </p>
                            <div className="mt-2 grid gap-2">
                              <input value={newPartner.name} onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })} placeholder="Nama percetakan / pusat" className="input" aria-label="Nama mitra baru" />
                              <select value={newPartner.kind} onChange={(e) => setNewPartner({ ...newPartner, kind: e.target.value })} className="input" aria-label="Jenis mitra">
                                {PARTNER_KINDS.map((kind) => (
                                  <option key={kind.key} value={kind.key}>
                                    {kind.label}
                                  </option>
                                ))}
                              </select>
                              <input value={newPartner.phone} onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })} placeholder="No. WhatsApp" className="input" aria-label="Nomor WhatsApp mitra" />
                              <input value={newPartner.address} onChange={(e) => setNewPartner({ ...newPartner, address: e.target.value })} placeholder="Alamat (opsional)" className="input" aria-label="Alamat mitra" />
                            </div>
                            <button type="button" onClick={() => createNewPartner(k)} disabled={partnerBusy} className="btn-secondary mt-2 w-full">
                              <Plus size={14} /> {partnerBusy ? "Menyimpan…" : "Simpan mitra"}
                            </button>
                          </div>
                        ) : null}

                        <div>
                          <label className="label" htmlFor={`nm-nama-${k}`}>Nama yang dicatat</label>
                          <input id={`nm-nama-${k}`} value={m.partnerName} onChange={(e) => patchMitra(k, { partnerName: e.target.value })} placeholder="Contoh: Percetakan Sinar Abadi" className="input" />
                        </div>

                        {/* Pilihan produk hanya muncul kalau pekerjaan berisi lebih dari satu produk. */}
                        {multiItem ? (
                          <div>
                            <p className="label">Produk yang dikerjakan mitra ini</p>
                            <p className="-mt-1 mb-1.5 text-[11px] text-[color:var(--pf-ink-3)]">
                              Produk yang tidak dicentang di mitra mana pun dikerjakan sendiri.
                            </p>
                            <div className="grid gap-1.5">
                              {filledRows.map((row) => {
                                const item = items[row];
                                const checked = m.rows.includes(row);
                                const other = mitraList.find((o) => o.key !== k && o.rows.includes(row));
                                return (
                                  <label
                                    key={row}
                                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2 text-[13px] transition-colors ${
                                      checked
                                        ? "border-[color:var(--pf-accent)] bg-[color:var(--pf-accent-soft)]"
                                        : "border-[color:var(--pf-line)] bg-[color:var(--pf-surface-2)]"
                                    }`}
                                  >
                                    <input type="checkbox" checked={checked} onChange={() => toggleMitraItem(k, row)} className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600" />
                                    <span className="min-w-0">
                                      <span className="block font-medium text-[color:var(--pf-ink)]">{item.productType}</span>
                                      <span className="block text-[11px] text-[color:var(--pf-ink-3)]">
                                        {item.quantity} {item.unit}
                                        {other ? ` · sekarang di ${other.partnerName || `mitra ${mitraList.indexOf(other) + 1}`}` : ""}
                                      </span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="label" htmlFor={`nm-status-${k}`}>Status di mitra</label>
                            <select id={`nm-status-${k}`} value={m.status} onChange={(e) => patchMitra(k, { status: e.target.value })} className="input">
                              {OUTSOURCE_STATUSES.map((st) => (
                                <option key={st.key} value={st.key}>
                                  {st.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="label" htmlFor={`nm-biaya-${k}`}>Biaya mitra (Rp)</label>
                            <input id={`nm-biaya-${k}`} type="number" inputMode="numeric" min={0} step={1000} value={m.vendorCost} onChange={(e) => patchMitra(k, { vendorCost: e.target.value })} className="input" />
                          </div>
                          <div>
                            <label className="label">Target barang kembali</label>
                            <DateFieldID value={m.expectedDate} onChange={(iso) => patchMitra(k, { expectedDate: iso, expectedTouched: true })} className="input" />
                          </div>
                          <div>
                            <label className="label" htmlFor={`nm-jam-${k}`}>Jam kembali</label>
                            <input id={`nm-jam-${k}`} type="time" value={m.expectedTime} onChange={(e) => patchMitra(k, { expectedTime: e.target.value })} className="input" />
                          </div>
                        </div>

                        <div>
                          <label className="label" htmlFor={`nm-catatan-${k}`}>Catatan untuk mitra / spesifikasi penting</label>
                          <textarea id={`nm-catatan-${k}`} rows={2} value={m.notes} onChange={(e) => patchMitra(k, { notes: e.target.value })} placeholder="Bahan, ukuran, warna, finishing, file yang dikirim" className="input" />
                        </div>

                        {selected?.phone ? (
                          <a
                            href={`https://wa.me/${selected.phone.replace(/\D/g, "").replace(/^0/, "62")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--pf-accent-strong)] hover:underline"
                          >
                            <Phone size={13} /> Hubungi {selected.name} via WhatsApp
                          </a>
                        ) : null}
                      </div>
                    </fieldset>
                  );
                })}

                <button type="button" onClick={addMitra} className="btn-ghost w-full">
                  <Plus size={15} /> Tambah mitra lain
                </button>

                {/* Hitungan margin langsung nyambung ke harga di kolom kiri. */}
                <div className="grid grid-cols-3 gap-2">
                  <Metric label="Harga pelanggan" value={formatRupiah(orderPrice)} />
                  <Metric label={mitraList.length > 1 ? "Total biaya mitra" : "Biaya mitra"} value={formatRupiah(totalCost)} />
                  <Metric label="Margin kotor" value={`${formatRupiah(margin)} · ${marginPercent}%`} danger={margin < 0} />
                </div>

                {lateRisk ? (
                  <p className="flex items-start gap-1.5 rounded-xl bg-[color:var(--pf-warn-soft)] px-3 py-2 text-xs font-medium text-[color:var(--pf-warn)]">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>Ada target barang kembali yang sama atau melewati deadline pelanggan. Sisakan waktu untuk QC dan revisi.</span>
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/* FOTO - kartu kedua di kolom ini, sama-sama opsional seperti
              Produksi Mitra di atasnya. Disimpan di memori browser dulu
              (belum ada orderId), baru benar-benar diunggah begitu tombol
              Simpan di bawah ditekan dan pekerjaannya berhasil dibuat. */}
          <section className="card p-4 md:p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
              <Camera size={16} /> Foto pekerjaan <span className="font-normal text-slate-400">(opsional)</span>
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Lampirkan desain dari pelanggan atau foto referensi sekarang juga, supaya tidak perlu buka halaman
              detail lagi cuma untuk itu.
            </p>
            <div className="mt-3">
              <NewOrderPhotoPicker photos={pendingPhotos} onChange={setPendingPhotos} disabled={saving} />
            </div>
          </section>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
          {savedId ? (
            <>
              {" "}
              <a href={`/pesanan/${savedId}`} className="font-semibold underline">
                Buka detail pekerjaan →
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap gap-2 rounded-t-2xl border-t border-slate-200/70 bg-[var(--page)]/92 px-1 py-3 backdrop-blur dark:border-white/10">
        <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-1.5">
          {saving ? (
            stage ?? "Menyimpan…"
          ) : (
            <>
              <Save size={15} /> {useOutsource ? (mitraList.length > 1 ? `Simpan Pekerjaan + ${mitraList.length} Mitra` : "Simpan Pekerjaan + Mitra") : "Simpan & Mulai Pantau"}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            if (pendingPhotos.length && !confirm(`Batalkan? ${pendingPhotos.length} foto yang sudah dipilih akan hilang.`)) return;
            router.push("/pesanan");
          }}
          className="btn-ghost"
        >
          Batal
        </button>
      </div>
    </form>
  );
}

/** Judul kolom dengan pita warna, biar dua kolom tidak tertukar saat dilihat sekilas. */
function ColumnHeader({
  icon,
  tone,
  step,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  tone: "teal" | "amber";
  step: string;
  title: string;
  subtitle: string;
}) {
  const tones = {
    teal: "border-teal-200 bg-teal-50/70 text-teal-700 dark:border-teal-800/50 dark:bg-teal-500/10 dark:text-teal-300",
    amber:
      "border-amber-300/70 bg-amber-100/60 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  };
  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-3.5 py-3 ${tones[tone]}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 dark:bg-white/10">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[.11em] opacity-75">{step}</p>
        <p className="text-sm font-semibold text-[color:var(--pf-ink)] dark:text-slate-100">{title}</p>
        <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-white/80 px-2.5 py-2 dark:bg-white/[0.06]">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-[11px] font-semibold ${danger ? "text-rose-600" : "text-[color:var(--pf-ink)] dark:text-slate-100"}`}>
        {value}
      </p>
    </div>
  );
}

function defaultDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** Sehari sebelum tanggal ISO yang diberikan - dipakai sebagai default target barang kembali dari mitra. */
function dayBefore(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return toIsoDate(date);
}

function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Satu mitra yang sedang diisi di form (belum tersimpan). */
type MitraDraft = {
  key: number;
  partnerId: string;
  partnerName: string;
  status: string;
  vendorCost: string;
  expectedDate: string;
  expectedTime: string;
  notes: string;
  /** Target kembali sudah diubah manual, jadi tidak ikut bergeser saat deadline pelanggan diganti. */
  expectedTouched: boolean;
  /** Posisi baris di tabel Item Pekerjaan yang dikerjakan mitra ini. */
  rows: number[];
};

let mitraSeq = 0;

function newMitraDraft(customerDue: string, rows: number[]): MitraDraft {
  mitraSeq += 1;
  return {
    key: mitraSeq,
    partnerId: "",
    partnerName: "",
    status: "belum_dikirim",
    vendorCost: "0",
    expectedDate: customerDue ? dayBefore(customerDue) : "",
    expectedTime: "12:00",
    notes: "",
    expectedTouched: false,
    rows,
  };
}
