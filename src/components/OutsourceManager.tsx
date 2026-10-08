"use client";

import { TimeFieldID } from "@/components/TimeFieldID";
import { Select } from "@/components/Select";
import { AlertTriangle, Building2, CheckCircle2, ExternalLink, Pencil, Phone, Plus, Save, Trash2, Truck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { OUTSOURCE_STATUSES, PARTNER_KINDS, outsourceStatusMeta, partnerKindLabel } from "@/lib/outsource";
import { formatDateID, formatRupiah } from "@/lib/domain";
import type { OutsourceRecord } from "@/lib/outsource-queries";
import type { OrderItem } from "@/lib/order-items";

type Partner = { id: number; name: string; kind: string; phone: string | null; address: string | null; active: boolean };

/**
 * PRODUKSI MITRA, BISA LEBIH DARI SATU
 * ---------------------------------------------------------------
 * Tampilan dibuat bertingkat supaya tetap ringan untuk karyawan:
 *
 *   - Belum ada mitra   : satu tombol "Alihkan ke Mitra" (seperti dulu).
 *   - Sudah ada mitra   : tiap mitra tampil sebagai ringkasan satu kartu
 *                         (nama, status, produk, target, biaya). Formulir
 *                         lengkap baru terbuka saat menekan "Ubah".
 *   - Mitra kedua dst.  : tombol "Tambah mitra lain".
 *
 * Kalau pekerjaan berisi beberapa produk, formulir menampilkan pilihan
 * produk yang dikerjakan mitra itu. Satu produk hanya bisa di satu mitra;
 * produk yang sudah dipegang mitra lain diberi keterangan.
 */
export function OutsourceManager({
  orderId,
  orderPrice,
  customerDueDate,
  jobs,
  items,
  initialPartners,
}: {
  orderId: number;
  orderPrice: number;
  customerDueDate: string;
  jobs: OutsourceRecord[];
  items: OrderItem[];
  initialPartners: Partner[];
}) {
  const [partners, setPartners] = useState(initialPartners);
  const [editing, setEditing] = useState<number | "new" | null>(null);

  const totalCost = jobs.reduce((sum, j) => sum + (j.vendorCost || 0), 0);
  const margin = orderPrice - totalCost;
  const marginPercent = orderPrice > 0 ? Math.round((margin / orderPrice) * 100) : 0;
  const multiItem = items.length > 1;

  if (!jobs.length && editing === null) {
    return (
      <div className="card border-dashed p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="icon-tile">
              <Truck size={18} />
            </span>
            <div>
              <h3 className="section-title">Produksi Mitra / Lempar Keluar</h3>
              <p className="mt-0.5 text-xs text-[color:var(--pf-ink-3)]">
                Gunakan bila pekerjaan{multiItem ? " atau sebagian produknya" : ""} dikerjakan percetakan lain atau pusat.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => setEditing("new")} className="btn-secondary">
            <ExternalLink size={15} /> Alihkan ke Mitra
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <header className="pf-panel-head">
        <span className="icon-tile h-8 w-8">
          <Truck size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="pf-panel-title">Produksi Mitra{jobs.length > 1 ? ` (${jobs.length})` : ""}</h3>
          <p className="pf-panel-sub">Pantau pekerjaan yang dikerjakan di luar</p>
        </div>
      </header>

      <div className="space-y-3 p-4">
        {jobs.map((job) =>
          editing === job.id ? (
            <JobForm
              key={job.id}
              orderId={orderId}
              customerDueDate={customerDueDate}
              job={job}
              jobs={jobs}
              items={items}
              partners={partners}
              setPartners={setPartners}
              onClose={() => setEditing(null)}
            />
          ) : (
            <JobSummary key={job.id} job={job} items={items} partners={partners} onEdit={() => setEditing(job.id)} disabled={editing !== null} />
          ),
        )}

        {editing === "new" ? (
          <JobForm
            orderId={orderId}
            customerDueDate={customerDueDate}
            job={null}
            jobs={jobs}
            items={items}
            partners={partners}
            setPartners={setPartners}
            onClose={() => setEditing(null)}
          />
        ) : jobs.length ? (
          <button type="button" onClick={() => setEditing("new")} disabled={editing !== null} className="btn-ghost w-full">
            <Plus size={15} /> Tambah mitra lain
          </button>
        ) : null}

        {jobs.length ? (
          <div className="grid grid-cols-3 gap-2 border-t border-[color:var(--pf-line-soft)] pt-3">
            <Metric label="Harga ke pelanggan" value={formatRupiah(orderPrice)} />
            <Metric label={jobs.length > 1 ? "Total biaya mitra" : "Biaya mitra"} value={formatRupiah(totalCost)} />
            <Metric label="Margin kotor" value={`${formatRupiah(margin)} (${marginPercent}%)`} danger={margin < 0} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ================================================================= */

function JobSummary({
  job,
  items,
  partners,
  onEdit,
  disabled,
}: {
  job: OutsourceRecord;
  items: OrderItem[];
  partners: Partner[];
  onEdit: () => void;
  disabled: boolean;
}) {
  const meta = outsourceStatusMeta(job.status);
  const names = job.itemIds.map((id) => items.find((i) => i.id === id)?.productType).filter(Boolean);
  const phone = partners.find((p) => p.id === job.partnerId)?.phone;
  return (
    <div className="rounded-xl border border-[color:var(--pf-line)] bg-[color:var(--pf-surface-2)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-[color:var(--pf-ink)]">
            <Building2 size={14} className="shrink-0 text-[color:var(--pf-ink-3)]" /> {job.partnerName}
          </p>
          <p className="mt-0.5 text-xs text-[color:var(--pf-ink-3)]">
            {items.length > 1 ? (names.length ? names.join(", ") : "Seluruh pekerjaan") : null}
          </p>
        </div>
        <span className={`chip shrink-0 ${meta.color}`}>{meta.short}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[color:var(--pf-ink-2)]">
        <span>
          Kembali <b className="font-semibold text-[color:var(--pf-ink)]">{formatDateID(job.expectedDate)} {job.expectedTime}</b>
        </span>
        <span>
          Biaya <b className="pf-num font-semibold text-[color:var(--pf-ink)]">{formatRupiah(job.vendorCost)}</b>
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button type="button" onClick={onEdit} disabled={disabled} className="btn-ghost min-h-9 px-3 py-1.5 text-xs">
          <Pencil size={13} /> Ubah
        </button>
        {phone ? (
          <a
            href={`https://wa.me/${phone.replace(/\D/g, "").replace(/^0/, "62")}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost min-h-9 px-3 py-1.5 text-xs"
          >
            <Phone size={13} /> WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  );
}

/* ================================================================= */

function JobForm({
  orderId,
  customerDueDate,
  job,
  jobs,
  items,
  partners,
  setPartners,
  onClose,
}: {
  orderId: number;
  customerDueDate: string;
  job: OutsourceRecord | null;
  jobs: OutsourceRecord[];
  items: OrderItem[];
  partners: Partner[];
  setPartners: (fn: (p: Partner[]) => Partner[]) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [partnerId, setPartnerId] = useState(String(job?.partnerId ?? ""));
  const [partnerName, setPartnerName] = useState(job?.partnerName ?? "");
  const [status, setStatus] = useState(job?.status ?? "belum_dikirim");
  const [vendorCost, setVendorCost] = useState(String(job?.vendorCost ?? 0));
  const [expectedDate, setExpectedDate] = useState(job?.expectedDate ?? customerDueDate);
  const [expectedTime, setExpectedTime] = useState(job?.expectedTime ?? "12:00");
  const [notes, setNotes] = useState(job?.notes ?? "");
  const [qcResult, setQcResult] = useState(job?.qcResult ?? "");
  // Mitra baru di pekerjaan multi produk: default memilih produk yang belum dipegang mitra lain.
  const [itemIds, setItemIds] = useState<number[]>(() => {
    if (job) return job.itemIds;
    if (items.length <= 1) return [];
    const taken = new Set(jobs.flatMap((j) => j.itemIds));
    return items.filter((i) => !taken.has(i.id)).map((i) => i.id);
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<ReactNode | null>(null);
  const [addPartner, setAddPartner] = useState(false);
  const [newPartner, setNewPartner] = useState({ name: "", kind: "vendor", phone: "", address: "" });

  const multiItem = items.length > 1;
  const owner = (itemId: number) => jobs.find((j) => j.id !== job?.id && j.itemIds.includes(itemId));

  function selectPartner(value: string) {
    setPartnerId(value);
    const partner = partners.find((p) => String(p.id) === value);
    if (partner) setPartnerName(partner.name);
  }

  function toggleItem(id: number) {
    setItemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    if (!partnerName.trim() || !expectedDate) {
      setMessage("Nama mitra dan target barang kembali wajib diisi.");
      return;
    }
    if (multiItem && !itemIds.length) {
      setMessage("Pilih minimal satu produk yang dikerjakan mitra ini.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/outsource`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: job?.id ?? null,
          partnerId: Number(partnerId) || null,
          partnerName,
          status,
          vendorCost: Math.max(0, Number(vendorCost) || 0),
          expectedDate,
          expectedTime,
          notes,
          qcResult,
          itemIds: multiItem ? itemIds : [],
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setMessage(json.error ?? "Gagal menyimpan produksi mitra.");
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setMessage("Tidak dapat menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!job) return;
    if (!confirm(`Hapus ${job.partnerName} dari pekerjaan ini? Riwayat lama tetap tercatat.`)) return;
    setBusy(true);
    await fetch(`/api/orders/${orderId}/outsource?jobId=${job.id}`, { method: "DELETE" });
    router.refresh();
    setBusy(false);
    onClose();
  }

  async function createNewPartner() {
    if (!newPartner.name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newPartner) });
    const json = (await res.json()) as { ok: boolean; data?: Partner; error?: string };
    if (json.ok && json.data) {
      const created = json.data;
      setPartners((p) => [...p, created]);
      setPartnerId(String(created.id));
      setPartnerName(created.name);
      setAddPartner(false);
      setNewPartner({ name: "", kind: "vendor", phone: "", address: "" });
    } else setMessage(json.error ?? "Gagal menambah mitra.");
    setBusy(false);
  }

  return (
    <div className="rounded-xl border border-[color:var(--pf-accent-line)] bg-[color:var(--pf-surface)] p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[color:var(--pf-ink)]">{job ? `Ubah ${job.partnerName}` : "Mitra baru"}</p>
        <button type="button" onClick={onClose} disabled={busy} className="pf-icon-btn" aria-label="Tutup formulir">
          <X size={15} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`mitra-pilih-${job?.id ?? "baru"}`}>
            Mitra / percetakan pusat
          </label>
          <div className="flex gap-2">
            <Select id={`mitra-pilih-${job?.id ?? "baru"}`} value={partnerId} onChange={(e) => selectPartner(e.target.value)} className="input">
              <option value="">Pilih mitra atau ketik manual</option>
              {partners
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {partnerKindLabel(p.kind)}
                  </option>
                ))}
            </Select>
            <button type="button" onClick={() => setAddPartner(!addPartner)} className="btn-ghost shrink-0 px-3" title="Tambah mitra" aria-label="Tambah mitra baru">
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div>
          <label className="label" htmlFor={`mitra-nama-${job?.id ?? "baru"}`}>
            Nama yang dicatat
          </label>
          <input id={`mitra-nama-${job?.id ?? "baru"}`} value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Contoh: Percetakan Sinar Abadi" className="input" />
        </div>

        {addPartner ? (
          <div className="rounded-xl border border-[color:var(--pf-accent-line)] bg-[color:var(--pf-accent-soft)] p-3 sm:col-span-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--pf-accent-strong)]">
              <Building2 size={14} /> Tambah mitra baru
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input value={newPartner.name} onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })} placeholder="Nama percetakan / pusat" className="input" aria-label="Nama mitra baru" />
              <Select value={newPartner.kind} onChange={(e) => setNewPartner({ ...newPartner, kind: e.target.value })} className="input" aria-label="Jenis mitra">
                {PARTNER_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </Select>
              <input value={newPartner.phone} onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })} placeholder="No. WhatsApp" className="input" aria-label="Nomor WhatsApp mitra" />
              <input value={newPartner.address} onChange={(e) => setNewPartner({ ...newPartner, address: e.target.value })} placeholder="Alamat (opsional)" className="input" aria-label="Alamat mitra" />
            </div>
            <button type="button" onClick={createNewPartner} disabled={busy} className="btn-secondary mt-2">
              <Plus size={14} /> Simpan mitra
            </button>
          </div>
        ) : null}

        {multiItem ? (
          <fieldset className="sm:col-span-2">
            <legend className="label">Produk yang dikerjakan mitra ini</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {items.map((item) => {
                const other = owner(item.id);
                const checked = itemIds.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] transition-colors ${
                      checked
                        ? "border-[color:var(--pf-accent)] bg-[color:var(--pf-accent-soft)]"
                        : "border-[color:var(--pf-line)] bg-[color:var(--pf-surface-2)]"
                    }`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleItem(item.id)} className="mt-0.5 h-4 w-4 accent-teal-600" />
                    <span className="min-w-0">
                      <span className="block font-medium text-[color:var(--pf-ink)]">{item.productType}</span>
                      <span className="block text-[11px] text-[color:var(--pf-ink-3)]">
                        {item.quantity} {item.unit}
                        {other ? ` · sekarang di ${other.partnerName}, akan dipindah` : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        <div>
          <label className="label" htmlFor={`mitra-status-${job?.id ?? "baru"}`}>
            Status di mitra
          </label>
          <Select id={`mitra-status-${job?.id ?? "baru"}`} value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            {OUTSOURCE_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="label" htmlFor={`mitra-biaya-${job?.id ?? "baru"}`}>
            Biaya mitra (Rp)
          </label>
          <input id={`mitra-biaya-${job?.id ?? "baru"}`} type="number" inputMode="numeric" min={0} step={1000} value={vendorCost} onChange={(e) => setVendorCost(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label" htmlFor={`mitra-tgl-${job?.id ?? "baru"}`}>
            Target barang kembali
          </label>
          <input id={`mitra-tgl-${job?.id ?? "baru"}`} type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label" htmlFor={`mitra-jam-${job?.id ?? "baru"}`}>
            Jam kembali
          </label>
          <TimeFieldID id={`mitra-jam-${job?.id ?? "baru"}`} value={expectedTime} onChange={setExpectedTime} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor={`mitra-catatan-${job?.id ?? "baru"}`}>
            Catatan untuk mitra / spesifikasi penting
          </label>
          <textarea id={`mitra-catatan-${job?.id ?? "baru"}`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bahan, ukuran, warna, finishing, file yang dikirim" className="input" />
        </div>
        {status === "diterima" || status === "revisi" ? (
          <div className="sm:col-span-2">
            <label className="label" htmlFor={`mitra-qc-${job?.id ?? "baru"}`}>
              Hasil QC saat barang diterima
            </label>
            <textarea id={`mitra-qc-${job?.id ?? "baru"}`} rows={2} value={qcResult} onChange={(e) => setQcResult(e.target.value)} placeholder="Jumlah sesuai, warna aman, ada 3 lembar reject" className="input" />
          </div>
        ) : null}
      </div>

      {expectedDate >= customerDueDate ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-[color:var(--pf-warn-soft)] px-3 py-2 text-xs font-medium text-[color:var(--pf-warn)]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Target barang kembali sama atau melewati deadline pelanggan. Sisakan waktu untuk QC, revisi, dan pengiriman.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={busy} className="btn-primary">
          <Save size={15} /> {busy ? "Menyimpan" : "Simpan mitra"}
        </button>
        <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">
          Batal
        </button>
        {job ? (
          <button type="button" onClick={remove} disabled={busy} className="btn-danger sm:ml-auto">
            <Trash2 size={15} /> Hapus mitra ini
          </button>
        ) : null}
      </div>
      {message ? (
        <p role="status" className="mt-2 flex items-center gap-1.5 rounded-xl bg-[color:var(--pf-danger-soft)] px-3 py-2 text-xs font-medium text-[color:var(--pf-danger)]">
          <CheckCircle2 size={13} className="hidden" />
          {message}
        </p>
      ) : null}
    </div>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl bg-[color:var(--pf-surface-2)] px-3 py-2">
      <p className="truncate text-[11px] text-[color:var(--pf-ink-3)]">{label}</p>
      <p className={`pf-num mt-0.5 truncate text-xs font-semibold ${danger ? "text-[color:var(--pf-danger)]" : "text-[color:var(--pf-ink)]"}`}>{value}</p>
    </div>
  );
}
