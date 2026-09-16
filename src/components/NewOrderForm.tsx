"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Building2, ClipboardList, Phone, Plus, Truck, X } from "lucide-react";
import { DateFieldID } from "@/components/DateFieldID";
import { estimateHours, formatRupiah, humanDuration } from "@/lib/domain";
import { MACHINES, PRIORITIES, PRODUCT_TYPES, UNITS } from "@/lib/domain";
import { OUTSOURCE_STATUSES, PARTNER_KINDS, partnerKindLabel } from "@/lib/outsource";

type CustomerOption = { id: number; name: string; phone: string | null };
type PartnerOption = { id: number; name: string; kind: string; phone: string | null; active: boolean };

const inputCls = "input";

/**
 * Form pekerjaan baru.
 *
 * Desktop (lg ke atas): dua kolom bersebelahan — KIRI data pekerjaan,
 * KANAN produksi mitra (lempar keluar) — dipisah garis vertikal tegas
 * supaya tidak tertukar. Mobile: satu kolom scroll biasa, dipisah
 * pembatas horizontal berlabel.
 *
 * Data mitra baru dikirim SETELAH order berhasil dibuat (butuh orderId),
 * lewat endpoint yang sama dengan yang dipakai halaman detail.
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
  const [productType, setProductType] = useState(PRODUCT_TYPES[0]);
  const [quantity, setQuantity] = useState("100");
  const [unit, setUnit] = useState(UNITS[0]);
  const [machine, setMachine] = useState(MACHINES[0]);
  const [operator, setOperator] = useState("");
  const [priority, setPriority] = useState("normal");
  const [price, setPrice] = useState("0");
  const [paidAmount, setPaidAmount] = useState("0");
  const [dueDate, setDueDate] = useState(defaultDate(2));
  const [dueTime, setDueTime] = useState("17:00");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  // ——— Kolom kanan: produksi mitra ———
  const [useOutsource, setUseOutsource] = useState(false);
  const [partners, setPartners] = useState<PartnerOption[]>(initialPartners);
  const [partnerId, setPartnerId] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [outStatus, setOutStatus] = useState("belum_dikirim");
  const [vendorCost, setVendorCost] = useState("0");
  const [expectedDate, setExpectedDate] = useState(dayBefore(defaultDate(2)));
  const [expectedTime, setExpectedTime] = useState("12:00");
  const [outNotes, setOutNotes] = useState("");
  const [expectedTouched, setExpectedTouched] = useState(false);
  const [addPartner, setAddPartner] = useState(false);
  const [newPartner, setNewPartner] = useState({ name: "", kind: "vendor", phone: "", address: "" });
  const [partnerBusy, setPartnerBusy] = useState(false);

  const estimate = useMemo(
    () => estimateHours(productType, Number.parseInt(quantity || "1", 10)),
    [productType, quantity],
  );

  const orderPrice = Math.max(0, Number(price) || 0);
  const cost = Math.max(0, Number(vendorCost) || 0);
  const margin = orderPrice - cost;
  const marginPercent = orderPrice > 0 ? Math.round((margin / orderPrice) * 100) : 0;
  const selectedPartner = partners.find((p) => String(p.id) === partnerId);
  const lateRisk = Boolean(useOutsource && expectedDate && dueDate && expectedDate >= dueDate);

  /** Deadline pelanggan berubah → target barang kembali ikut mundur, selama belum diubah manual. */
  function changeDueDate(value: string) {
    setDueDate(value);
    if (!expectedTouched && value) setExpectedDate(dayBefore(value));
  }

  function selectPartner(value: string) {
    setPartnerId(value);
    const partner = partners.find((p) => String(p.id) === value);
    if (partner) setPartnerName(partner.name);
  }

  async function createNewPartner() {
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
        setPartners((p) => [...p, json.data!]);
        setPartnerId(String(json.data.id));
        setPartnerName(json.data.name);
        setAddPartner(false);
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
    // Validasi kolom kanan DULU supaya tidak terlanjur membuat order lalu gagal di tengah jalan.
    if (useOutsource && (!partnerName.trim() || !expectedDate)) {
      setError("Kolom mitra aktif: nama mitra dan target barang kembali wajib diisi (atau matikan panel mitra).");
      return;
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
          productType,
          quantity: Number.parseInt(quantity || "1", 10),
          unit,
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
      const json = (await res.json()) as { ok: boolean; data?: { id: number }; error?: string };
      if (!json.ok || !json.data) {
        setError(json.error ?? "Gagal menyimpan.");
        return;
      }
      const orderId = json.data.id;

      if (useOutsource) {
        const res2 = await fetch(`/api/orders/${orderId}/outsource`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            partnerId: Number(partnerId) || null,
            partnerName: partnerName.trim(),
            status: outStatus,
            vendorCost: cost,
            expectedDate,
            expectedTime,
            notes: outNotes,
          }),
        });
        const json2 = (await res2.json()) as { ok: boolean; error?: string };
        if (!json2.ok) {
          // Order-nya sudah aman tersimpan — jangan sampai hilang. Kasih jalan lanjut.
          setSavedId(orderId);
          setError(
            `Pekerjaan berhasil disimpan, tapi data mitra gagal disimpan (${json2.error ?? "kesalahan server"}). Buka detail pekerjaan untuk melengkapinya.`,
          );
          return;
        }
      }

      router.push(`/pesanan/${orderId}`);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setSaving(false);
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
            subtitle="Wajib diisi — ini yang dicatat sebagai order pelanggan."
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
                  placeholder="Contoh: Spanduk opening 3x1 meter"
                  className={inputCls}
                />
              </div>
            </div>
          </section>

          <section className="card p-4 md:p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">2. Detail cetakan</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="label">Jenis produk</label>
                <select value={productType} onChange={(e) => setProductType(e.target.value)} className={inputCls}>
                  {PRODUCT_TYPES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Jumlah</label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="label">Satuan</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
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
            <p className="mt-3 rounded-xl bg-teal-50 px-3 py-2 text-xs font-medium text-teal-800 dark:bg-teal-500/10 dark:text-teal-200">
              🤖 AI memperkirakan pekerjaan ini butuh ± <strong>{estimate} jam kerja</strong> ({humanDuration(estimate)}).
              Angka ini dipakai untuk menghitung risiko telat.
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
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
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
                onChange={(e) => setUseOutsource(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
              />
              <span className="min-w-0">
                <span className="block text-sm font-extrabold text-[#07384f] dark:text-slate-100">
                  Lempar pekerjaan ini ke mitra
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Centang untuk langsung mencatat vendor, biaya, dan target barang kembali — tanpa perlu buka halaman
                  detail dulu.
                </span>
              </span>
            </label>

            {!useOutsource ? (
              <p className="mt-3 rounded-xl border border-dashed border-amber-300/70 px-3 py-4 text-center text-xs font-medium text-amber-800/70 dark:border-amber-500/30 dark:text-amber-200/70">
                Dikerjakan sendiri di dalam? Biarkan saja kosong — panel ini akan diabaikan saat menyimpan.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="label">Mitra / percetakan pusat</label>
                  <div className="flex gap-2">
                    <select value={partnerId} onChange={(e) => selectPartner(e.target.value)} className="input">
                      <option value="">Ketik nama manual / pilih mitra…</option>
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
                      onClick={() => setAddPartner(!addPartner)}
                      className="btn-ghost shrink-0 px-3"
                      title="Tambah mitra baru"
                    >
                      {addPartner ? <X size={16} /> : <Plus size={16} />}
                    </button>
                  </div>
                </div>

                {addPartner ? (
                  <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3 dark:border-teal-800/50 dark:bg-teal-500/10">
                    <p className="flex items-center gap-1.5 text-xs font-extrabold text-teal-800 dark:text-teal-300">
                      <Building2 size={14} /> Tambah mitra baru
                    </p>
                    <div className="mt-2 grid gap-2">
                      <input
                        value={newPartner.name}
                        onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                        placeholder="Nama percetakan / pusat"
                        className="input"
                      />
                      <select
                        value={newPartner.kind}
                        onChange={(e) => setNewPartner({ ...newPartner, kind: e.target.value })}
                        className="input"
                      >
                        {PARTNER_KINDS.map((k) => (
                          <option key={k.key} value={k.key}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                      <input
                        value={newPartner.phone}
                        onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })}
                        placeholder="No. WhatsApp"
                        className="input"
                      />
                      <input
                        value={newPartner.address}
                        onChange={(e) => setNewPartner({ ...newPartner, address: e.target.value })}
                        placeholder="Alamat (opsional)"
                        className="input"
                      />
                    </div>
                    <button type="button" onClick={createNewPartner} disabled={partnerBusy} className="btn-secondary mt-2 w-full">
                      <Plus size={14} /> {partnerBusy ? "Menyimpan…" : "Simpan Mitra"}
                    </button>
                  </div>
                ) : null}

                <div>
                  <label className="label">Nama yang dicatat</label>
                  <input
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    placeholder="Contoh: Percetakan Sinar Abadi"
                    className="input"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Status di mitra</label>
                    <select value={outStatus} onChange={(e) => setOutStatus(e.target.value)} className="input">
                      {OUTSOURCE_STATUSES.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Biaya vendor (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={vendorCost}
                      onChange={(e) => setVendorCost(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Target barang kembali</label>
                    <DateFieldID
                      value={expectedDate}
                      onChange={(iso) => {
                        setExpectedTouched(true);
                        setExpectedDate(iso);
                      }}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Jam kembali</label>
                    <input
                      type="time"
                      value={expectedTime}
                      onChange={(e) => setExpectedTime(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Catatan untuk mitra / spesifikasi penting</label>
                  <textarea
                    rows={2}
                    value={outNotes}
                    onChange={(e) => setOutNotes(e.target.value)}
                    placeholder="Bahan, ukuran, warna, finishing, file yang dikirim…"
                    className="input"
                  />
                </div>

                {/* Hitungan margin langsung nyambung ke harga di kolom kiri. */}
                <div className="grid grid-cols-3 gap-2">
                  <Metric label="Harga pelanggan" value={formatRupiah(orderPrice)} />
                  <Metric label="Biaya mitra" value={formatRupiah(cost)} />
                  <Metric label="Margin kotor" value={`${formatRupiah(margin)} · ${marginPercent}%`} danger={margin < 0} />
                </div>

                {lateRisk ? (
                  <p className="rounded-xl border border-amber-300 bg-amber-100/70 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                    ⚠️ Target barang kembali sama/melewati deadline pelanggan ({dueDate}). Sisakan waktu untuk QC dan
                    revisi.
                  </p>
                ) : null}

                {selectedPartner?.phone ? (
                  <a
                    href={`https://wa.me/${selectedPartner.phone.replace(/\D/g, "").replace(/^0/, "62")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:underline dark:text-teal-300"
                  >
                    <Phone size={13} /> Hubungi {selectedPartner.name} via WhatsApp
                  </a>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
          {savedId ? (
            <>
              {" "}
              <a href={`/pesanan/${savedId}`} className="font-extrabold underline">
                Buka detail pekerjaan →
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap gap-2 rounded-t-2xl border-t border-slate-200/70 bg-[var(--page)]/92 px-1 py-3 backdrop-blur dark:border-white/10">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Menyimpan…" : useOutsource ? "💾 Simpan Pekerjaan + Mitra" : "💾 Simpan & Mulai Pantau"}
        </button>
        <button type="button" onClick={() => router.push("/pesanan")} className="btn-ghost">
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
        <p className="text-[10px] font-extrabold uppercase tracking-[.11em] opacity-75">{step}</p>
        <p className="text-sm font-extrabold text-[#07384f] dark:text-slate-100">{title}</p>
        <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-white/80 px-2.5 py-2 dark:bg-white/[0.06]">
      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-[11px] font-extrabold ${danger ? "text-rose-600" : "text-[#07384f] dark:text-slate-100"}`}>
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

/** Sehari sebelum tanggal ISO yang diberikan — dipakai sebagai default target barang kembali dari mitra. */
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
