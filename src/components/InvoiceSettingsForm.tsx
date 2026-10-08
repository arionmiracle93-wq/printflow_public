"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, ImagePlus, Landmark, Loader2, Palette, Plus, Save, Trash2, FileText, XCircle } from "lucide-react";
import { qrisValidate } from "@/lib/qris";
import type { BankAccount, InvoiceSettings } from "@/lib/invoice-settings";

type Tab = "usaha" | "bayar" | "dokumen" | "tampilan";

const TABS: { key: Tab; label: string; icon: typeof Building2 }[] = [
  { key: "usaha", label: "Usaha", icon: Building2 },
  { key: "bayar", label: "Bayar", icon: Landmark },
  { key: "dokumen", label: "Dokumen", icon: FileText },
  { key: "tampilan", label: "Tampilan", icon: Palette },
];

function thousands(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("id-ID") : "";
}

/** Pengaturan Invoice 4 tab (Usaha, Bayar, Dokumen, Tampilan) seperti app lama. Khusus Owner. */
export function InvoiceSettingsForm({ initial }: { initial: InvoiceSettings }) {
  const [tab, setTab] = useState<Tab>("usaha");
  const [businessName, setBusinessName] = useState(initial.businessName);
  const [address, setAddress] = useState(initial.address);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [banks, setBanks] = useState<BankAccount[]>(initial.banks);
  const [paymentNote, setPaymentNote] = useState(initial.paymentNote);
  const [dueDays, setDueDays] = useState(String(initial.dueDays));
  const [askPaidOnSave, setAskPaidOnSave] = useState(initial.askPaidOnSave);
  const [askPaidThreshold, setAskPaidThreshold] = useState(initial.askPaidThreshold ? thousands(String(initial.askPaidThreshold)) : "");
  const [qris, setQris] = useState(initial.qris);
  const [uniqueCode, setUniqueCode] = useState(initial.uniqueCode);
  const [showCustomerOnPrint, setShowCustomerOnPrint] = useState(initial.showCustomerOnPrint);
  const [showPdfButton, setShowPdfButton] = useState(initial.showPdfButton);
  const [showWaButton, setShowWaButton] = useState(initial.showWaButton);
  const [assetV, setAssetV] = useState({ signature: initial.signatureV, stamp: initial.stampV });
  const [assetBusy, setAssetBusy] = useState<null | "signature" | "stamp">(null);
  const sigInput = useRef<HTMLInputElement>(null);
  const stampInput = useRef<HTMLInputElement>(null);
  const qrisCheck = qris.trim() ? qrisValidate(qris) : null;
  const [terms, setTerms] = useState(initial.defaultTerms.join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function patchBank(i: number, patch: Partial<BankAccount>) {
    setBanks((l) => l.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  async function uploadAsset(kind: "signature" | "stamp", file: File | undefined) {
    if (!file) return;
    setError(null);
    setNotice(null);
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError("File harus gambar PNG, JPG, atau WebP.");
    if (file.size > 800 * 1024) return setError("Gambar terlalu besar, maksimal 800KB.");
    setAssetBusy(kind);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Gagal membaca file."));
        r.readAsDataURL(file);
      });
      const res = await fetch(`/api/invoice-assets/${kind}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; version?: number };
      if (!json.ok) return setError(json.error ?? "Gagal menyimpan gambar.");
      setAssetV((v) => ({ ...v, [kind]: json.version ?? v[kind] + 1 }));
      setNotice(kind === "signature" ? "Tanda tangan tersimpan." : "Stempel tersimpan.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan gambar.");
    } finally {
      setAssetBusy(null);
    }
  }

  async function removeAsset(kind: "signature" | "stamp") {
    if (!confirm(kind === "signature" ? "Hapus tanda tangan?" : "Hapus stempel?")) return;
    setError(null);
    setNotice(null);
    setAssetBusy(kind);
    try {
      const res = await fetch(`/api/invoice-assets/${kind}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!json.ok) return setError(json.error ?? "Gagal menghapus gambar.");
      setAssetV((v) => ({ ...v, [kind]: 0 }));
    } catch {
      setError("Koneksi terputus. Coba lagi.");
    } finally {
      setAssetBusy(null);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/invoice-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          address,
          email,
          phone,
          banks,
          paymentNote,
          dueDays: Number(dueDays) || 0,
          askPaidOnSave,
          askPaidThreshold: Number(askPaidThreshold.replace(/\D/g, "")) || 0,
          qris,
          uniqueCode,
          showPdfButton,
          showWaButton,
          showCustomerOnPrint,
          defaultTerms: terms,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; penjelasan?: string };
      if (!json.ok) setError(json.error ?? json.penjelasan ?? "Gagal menyimpan pengaturan.");
      else setNotice("Pengaturan tersimpan. Berlaku untuk semua dokumen yang dibuka setelah ini.");
    } catch {
      setError("Koneksi terputus. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`chip shrink-0 gap-1.5 px-3.5 py-2 text-xs font-bold ${
              tab === t.key ? "border-teal-500 bg-teal-500 text-white" : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "usaha" ? (
        <section className="card grid gap-3 p-4 sm:grid-cols-2">
          <label className="min-w-0 sm:col-span-2">
            <span className="label">Nama usaha (tampil di kop dokumen)</span>
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="input min-w-0" />
          </label>
          <label className="min-w-0 sm:col-span-2">
            <span className="label">Alamat (maksimal 2 baris, tekan Enter untuk baris baru)</span>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="input min-w-0" />
          </label>
          <label className="min-w-0">
            <span className="label">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" className="input min-w-0" />
          </label>
          <label className="min-w-0">
            <span className="label">WhatsApp / telepon</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="input min-w-0" />
          </label>
        </section>
      ) : null}

      {tab === "bayar" ? (
        <>
          <section className="card space-y-3 p-4">
            <div>
              <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Rekening bank</h2>
              <p className="text-xs text-slate-500">Tampil di dokumen Invoice bermetode Transfer, lengkap dengan tombol salin nomor.</p>
            </div>
            {banks.map((b, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1.4fr_1.4fr_auto] dark:border-slate-700">
                <input value={b.bank} onChange={(e) => patchBank(i, { bank: e.target.value })} placeholder="Bank (BCA, BRI...)" className="input min-w-0" aria-label="Nama bank" />
                <input value={b.no} onChange={(e) => patchBank(i, { no: e.target.value })} placeholder="Nomor rekening" inputMode="numeric" className="input min-w-0" aria-label="Nomor rekening" />
                <input value={b.name} onChange={(e) => patchBank(i, { name: e.target.value })} placeholder="Atas nama" className="input min-w-0" aria-label="Atas nama" />
                <button type="button" onClick={() => setBanks((l) => l.filter((_, idx) => idx !== i))} className="btn-ghost justify-self-end px-2 text-rose-600" aria-label="Hapus rekening">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {banks.length < 10 ? (
              <button type="button" onClick={() => setBanks((l) => [...l, { bank: "", no: "", name: "" }])} className="btn-secondary px-3 py-2 text-xs">
                <Plus size={14} /> Tambah rekening
              </button>
            ) : null}
            <label className="block min-w-0">
              <span className="label">Catatan pembayaran (tampil di bawah daftar rekening)</span>
              <input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Mohon kirim bukti transfer ke WhatsApp kami untuk verifikasi." className="input min-w-0" />
            </label>
          </section>

          <section className="card space-y-2 p-4">
            <div>
              <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">QRIS (payload statis)</h2>
              <p className="text-xs text-slate-500">Tempel teks hasil baca QRIS merchant Anda (diawali 000201...). Di dokumen bermetode QRIS, nominal otomatis ditanam ke dalam kodenya.</p>
            </div>
            <textarea value={qris} onChange={(e) => setQris(e.target.value)} rows={3} placeholder="00020101021126..." className="input min-w-0 font-mono text-xs" spellCheck={false} />
            {qrisCheck ? (
              qrisCheck.ok ? (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 size={14} /> Valid{qrisCheck.merchant ? ` · ${qrisCheck.merchant}` : ""}{qrisCheck.city ? ` · ${qrisCheck.city}` : ""}</p>
              ) : (
                <p className="flex items-start gap-1.5 text-xs font-semibold text-rose-700"><XCircle size={14} className="mt-0.5 shrink-0" /> {qrisCheck.msg}</p>
              )
            ) : null}
          </section>

          <section className="card grid gap-3 p-4 sm:grid-cols-2">
            <label className="min-w-0 sm:col-span-2">
              <span className="label">Jatuh tempo bawaan (hari sejak tanggal dokumen)</span>
              <input value={dueDays} onChange={(e) => setDueDays(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="input min-w-0 sm:max-w-40" />
              <span className="mt-1 block text-[11px] text-slate-400">0 = tanpa jatuh tempo. Contoh 7: invoice hari ini jatuh tempo minggu depan. Tanggal tetap bisa diubah di tiap dokumen.</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 sm:col-span-2">
              <input type="checkbox" checked={askPaidOnSave} onChange={(e) => setAskPaidOnSave(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-600" />
              <span>
                <span className="block text-sm font-bold text-[color:var(--pf-ink)]">Tanya saat menerbitkan Invoice</span>
                <span className="block text-xs text-slate-500">Saat Terbitkan, tanyakan apakah pembayaran sudah diterima. Kalau ya, langsung dicatat LUNAS.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 sm:col-span-2">
              <input type="checkbox" checked={uniqueCode} onChange={(e) => setUniqueCode(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-600" />
              <span>
                <span className="block text-sm font-bold text-[color:var(--pf-ink)]">Kode unik transfer</span>
                <span className="block text-xs text-slate-500">Menambah 1 sampai 899 rupiah ke nominal transfer (tetap sama untuk satu nomor dokumen), supaya pembayaran mudah dicocokkan di mutasi bank. Hanya untuk metode Transfer.</span>
              </span>
            </label>
            {askPaidOnSave ? (
              <label className="min-w-0 sm:col-span-2">
                <span className="label">Batas nilai ditanya (Rp)</span>
                <input value={askPaidThreshold} onChange={(e) => setAskPaidThreshold(thousands(e.target.value))} inputMode="numeric" placeholder="0" className="input min-w-0 sm:max-w-56" />
                <span className="mt-1 block text-[11px] text-slate-400">Invoice di bawah nilai ini tidak ditanya (dianggap boleh dibayar saat ambil barang). Isi 0 bila semua ingin ditanya.</span>
              </label>
            ) : null}
          </section>
        </>
      ) : null}

      {tab === "dokumen" ? (
        <section className="card space-y-3 p-4">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" checked={showCustomerOnPrint} onChange={(e) => setShowCustomerOnPrint(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-600" />
            <span>
              <span className="block text-sm font-bold text-[color:var(--pf-ink)]">Tampilkan data customer di lembar dokumen</span>
              <span className="block text-xs text-slate-500">Kalau mati, nama dan WhatsApp customer hanya terlihat di layar (bar Data Customer) dan tidak ikut tercetak.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" checked={showPdfButton} onChange={(e) => setShowPdfButton(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-600" />
            <span>
              <span className="block text-sm font-bold text-[color:var(--pf-ink)]">Tombol Unduh PDF</span>
              <span className="block text-xs text-slate-500">Menampilkan tombol Unduh PDF di halaman dokumen.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" checked={showWaButton} onChange={(e) => setShowWaButton(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-600" />
            <span>
              <span className="block text-sm font-bold text-[color:var(--pf-ink)]">Tombol Kirim WhatsApp</span>
              <span className="block text-xs text-slate-500">Membagikan PDF + teks pesan lewat WhatsApp. Kalau perangkat tidak bisa berbagi file, PDF diunduh dan WhatsApp dibuka ke nomor pelanggan.</span>
            </span>
          </label>
          <label className="block min-w-0">
            <span className="label">Syarat &amp; ketentuan bawaan (satu per baris)</span>
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={5} className="input min-w-0" />
          </label>
        </section>
      ) : null}

      {tab === "dokumen" ? (
        <section className="card space-y-3 p-4">
          <div>
            <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Tanda tangan &amp; stempel</h2>
            <p className="text-xs text-slate-500">Tampil di bagian bawah dokumen (di bawah tulisan Hormat kami). PNG transparan paling bagus. Maksimal 800KB. Tersimpan langsung saat dipilih.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              { kind: "signature" as const, label: "Tanda tangan", ref: sigInput },
              { kind: "stamp" as const, label: "Stempel", ref: stampInput },
            ]).map((a) => (
              <div key={a.kind} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="mb-2 text-xs font-bold text-slate-600">{a.label}</p>
                <div className="mb-2 flex h-24 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white">
                  {assetV[a.kind] > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/invoice-assets/${a.kind}?v=${assetV[a.kind]}`} alt={a.label} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-[11px] text-slate-400">Belum ada</span>
                  )}
                </div>
                <input ref={a.ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void uploadAsset(a.kind, e.target.files?.[0]); e.target.value = ""; }} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={assetBusy !== null} onClick={() => a.ref.current?.click()} className="btn-secondary px-3 py-1.5 text-xs">
                    {assetBusy === a.kind ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} {assetV[a.kind] > 0 ? "Ganti" : "Unggah"}
                  </button>
                  {assetV[a.kind] > 0 ? (
                    <button type="button" disabled={assetBusy !== null} onClick={() => void removeAsset(a.kind)} className="btn-ghost px-3 py-1.5 text-xs text-rose-600">
                      <Trash2 size={13} /> Hapus
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "tampilan" ? (
        <section className="card space-y-2 p-4 text-sm text-slate-600">
          <p><b className="text-[color:var(--pf-ink)]">Tema:</b> mengikuti tombol terang/gelap di bar atas PrintFlow. Kertas dokumen selalu tampil terang seperti lembar cetak asli.</p>
          <p><b className="text-[color:var(--pf-ink)]">Logo usaha:</b> memakai logo yang sama dengan PrintFlow.{" "}
            <Link href="/pengaturan" className="font-bold text-teal-700 underline">Ubah logo di Pengaturan</Link>.
          </p>
        </section>
      ) : null}

      {error ? <p className="break-words rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
      {notice ? <p className="break-words rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{notice}</p> : null}

      {tab !== "tampilan" ? (
        <button type="button" disabled={busy} onClick={() => void save()} className="btn-primary w-full sm:w-auto">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Pengaturan
        </button>
      ) : null}
    </div>
  );
}
