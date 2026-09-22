"use client";

import { AlertTriangle, Building2, CheckCircle2, ExternalLink, Phone, Plus, Save, Trash2, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { OUTSOURCE_STATUSES, PARTNER_KINDS, outsourceStatusMeta, partnerKindLabel } from "@/lib/outsource";
import { formatRupiah } from "@/lib/domain";
import type { OutsourceRecord } from "@/lib/outsource-queries";

type Partner = { id: number; name: string; kind: string; phone: string | null; address: string | null; active: boolean };

export function OutsourceManager({
  orderId,
  orderPrice,
  customerDueDate,
  current,
  initialPartners,
}: {
  orderId: number;
  orderPrice: number;
  customerDueDate: string;
  current: OutsourceRecord | null;
  initialPartners: Partner[];
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(Boolean(current));
  const [partners, setPartners] = useState(initialPartners);
  const [partnerId, setPartnerId] = useState(String(current?.partnerId ?? ""));
  const [partnerName, setPartnerName] = useState(current?.partnerName ?? "");
  const [status, setStatus] = useState(current?.status ?? "belum_dikirim");
  const [vendorCost, setVendorCost] = useState(String(current?.vendorCost ?? 0));
  const [expectedDate, setExpectedDate] = useState(current?.expectedDate ?? customerDueDate);
  const [expectedTime, setExpectedTime] = useState(current?.expectedTime ?? "12:00");
  const [notes, setNotes] = useState(current?.notes ?? "");
  const [qcResult, setQcResult] = useState(current?.qcResult ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<ReactNode | null>(null);
  const [addPartner, setAddPartner] = useState(false);
  const [newPartner, setNewPartner] = useState({ name: "", kind: "vendor", phone: "", address: "" });

  const selected = partners.find((p) => String(p.id) === partnerId);
  const cost = Math.max(0, Number(vendorCost) || 0);
  const margin = orderPrice - cost;
  const marginPercent = orderPrice > 0 ? Math.round((margin / orderPrice) * 100) : 0;
  const meta = outsourceStatusMeta(status);

  function selectPartner(value: string) {
    setPartnerId(value);
    const partner = partners.find((p) => String(p.id) === value);
    if (partner) setPartnerName(partner.name);
  }

  async function save() {
    if (!partnerName.trim() || !expectedDate) {
      setMessage("Nama mitra dan target barang kembali wajib diisi.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/outsource`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId: Number(partnerId) || null, partnerName, status, vendorCost: cost, expectedDate, expectedTime, notes, qcResult, actor: "Owner" }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) setMessage(json.error ?? "Gagal menyimpan produksi mitra.");
      else {
        setEnabled(true);
        setMessage(
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={13} className="shrink-0" /> Data produksi mitra tersimpan dan riwayat diperbarui.
          </span>,
        );
        router.refresh();
      }
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!confirm("Hapus pengaturan produksi mitra dari pekerjaan ini? Riwayat lama tetap tercatat.")) return;
    setBusy(true);
    await fetch(`/api/orders/${orderId}/outsource`, { method: "DELETE" });
    setEnabled(false);
    setMessage("Produksi mitra dihapus dari pekerjaan ini.");
    router.refresh();
    setBusy(false);
  }

  async function createNewPartner() {
    if (!newPartner.name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newPartner) });
    const json = (await res.json()) as { ok: boolean; data?: Partner; error?: string };
    if (json.ok && json.data) {
      setPartners((p) => [...p, json.data!]);
      setPartnerId(String(json.data.id));
      setPartnerName(json.data.name);
      setAddPartner(false);
      setNewPartner({ name: "", kind: "vendor", phone: "", address: "" });
    } else setMessage(json.error ?? "Gagal menambah mitra.");
    setBusy(false);
  }

  if (!enabled) {
    return (
      <div className="card border-dashed p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3"><span className="icon-tile"><Truck size={18} /></span><div><h3 className="text-sm font-extrabold text-[#07384f]">Produksi Mitra / Lempar Keluar</h3><p className="mt-0.5 text-xs text-slate-500">Gunakan bila pekerjaan dikerjakan percetakan lain atau pusat.</p></div></div>
          <button type="button" onClick={() => setEnabled(true)} className="btn-secondary"><ExternalLink size={15} /> Alihkan ke Mitra</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden border-teal-200">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-[#07384f] to-teal-700 px-4 py-3 text-white">
        <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><Truck size={18} /></span><div><h3 className="text-sm font-extrabold">Produksi Mitra</h3><p className="text-[10px] text-cyan-100/70">Pantau pekerjaan yang dikerjakan di luar</p></div></div>
        <span className={`chip ${meta.color}`}>{meta.label}</span>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Mitra / Percetakan Pusat</label>
            <div className="flex gap-2">
              <select value={partnerId} onChange={(e) => selectPartner(e.target.value)} className="input">
                <option value="">Ketik nama manual / pilih mitra…</option>
                {partners.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} · {partnerKindLabel(p.kind)}</option>)}
              </select>
              <button type="button" onClick={() => setAddPartner(!addPartner)} className="btn-ghost shrink-0 px-3" title="Tambah mitra"><Plus size={16} /></button>
            </div>
          </div>
          <div><label className="label">Nama yang dicatat</label><input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Contoh: Percetakan Sinar Abadi" className="input" /></div>
          <div><label className="label">Status di mitra</label><select value={status} onChange={(e) => setStatus(e.target.value)} className="input">{OUTSOURCE_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
          <div><label className="label">Biaya vendor / pusat (Rp)</label><input type="number" min={0} step={1000} value={vendorCost} onChange={(e) => setVendorCost(e.target.value)} className="input" /></div>
          <div><label className="label">Target barang kembali ke tempat Anda</label><input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="input" /></div>
          <div><label className="label">Jam kembali</label><input type="time" value={expectedTime} onChange={(e) => setExpectedTime(e.target.value)} className="input" /></div>
          <div className="sm:col-span-2"><label className="label">Catatan untuk mitra / spesifikasi penting</label><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bahan, ukuran, warna, finishing, file yang dikirim…" className="input" /></div>
          {status === "diterima" || status === "revisi" ? <div className="sm:col-span-2"><label className="label">Hasil QC saat barang diterima</label><textarea rows={2} value={qcResult} onChange={(e) => setQcResult(e.target.value)} placeholder="Jumlah sesuai, warna aman, ada 3 lembar reject…" className="input" /></div> : null}
        </div>

        {addPartner ? (
          <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3">
            <p className="flex items-center gap-1.5 text-xs font-extrabold text-teal-800"><Building2 size={14} /> Tambah mitra baru</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2"><input value={newPartner.name} onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })} placeholder="Nama percetakan / pusat" className="input" /><select value={newPartner.kind} onChange={(e) => setNewPartner({ ...newPartner, kind: e.target.value })} className="input">{PARTNER_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select><input value={newPartner.phone} onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })} placeholder="No. WhatsApp" className="input" /><input value={newPartner.address} onChange={(e) => setNewPartner({ ...newPartner, address: e.target.value })} placeholder="Alamat (opsional)" className="input" /></div>
            <button type="button" onClick={createNewPartner} disabled={busy} className="btn-secondary mt-2"><Plus size={14} /> Simpan Mitra</button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric label="Harga ke pelanggan" value={formatRupiah(orderPrice)} />
          <Metric label="Biaya mitra" value={formatRupiah(cost)} />
          <Metric label="Margin kotor" value={`${formatRupiah(margin)} (${marginPercent}%)`} danger={margin < 0} />
        </div>
        {expectedDate >= customerDueDate ? (
          <p className="flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Target barang kembali sama atau melewati deadline pelanggan. Sisakan waktu minimal untuk QC, revisi, dan pengiriman.
          </p>
        ) : null}
        {selected?.phone ? <a href={`https://wa.me/${selected.phone.replace(/\D/g, "").replace(/^0/, "62")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:underline"><Phone size={13} /> Hubungi {selected.name} via WhatsApp</a> : null}

        <div className="flex flex-wrap gap-2"><button type="button" onClick={save} disabled={busy} className="btn-primary"><Save size={15} /> {busy ? "Menyimpan…" : "Simpan Produksi Mitra"}</button>{current ? <button type="button" onClick={remove} disabled={busy} className="btn-danger"><Trash2 size={15} /> Hapus Pengaturan</button> : null}</div>
        {message ? <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{message}</p> : null}
      </div>
    </div>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-0.5 text-xs font-extrabold ${danger ? "text-rose-600" : "text-[#07384f]"}`}>{value}</p></div>;
}
