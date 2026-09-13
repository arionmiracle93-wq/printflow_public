"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { estimateHours, humanDuration } from "@/lib/domain";
import { MACHINES, OPERATOR_SUGGESTIONS, PRIORITIES, PRODUCT_TYPES, UNITS } from "@/lib/domain";

type CustomerOption = { id: number; name: string; phone: string | null };

const inputCls = "input";

export function NewOrderForm({ customers }: { customers: CustomerOption[] }) {
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

  const estimate = useMemo(
    () => estimateHours(productType, Number.parseInt(quantity || "1", 10)),
    [productType, quantity],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const finalName = customerId === "__new" ? customerName : customers.find((c) => String(c.id) === customerId)?.name;
    if (!finalName || !title || !dueDate) {
      setError("Nama pelanggan, nama pekerjaan, dan deadline wajib diisi.");
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
      router.push(`/pesanan/${json.data.id}`);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <section className="card p-4 md:p-5">
        <h2 className="text-sm font-bold text-slate-900">1. Pelanggan</h2>
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
        <h2 className="text-sm font-bold text-slate-900">2. Detail cetakan</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
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
              {OPERATOR_SUGGESTIONS.map((o) => (
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
        <p className="mt-3 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-800">
          🤖 AI memperkirakan pekerjaan ini butuh ± <strong>{estimate} jam kerja</strong> ({humanDuration(estimate)}).
          Angka ini dipakai untuk menghitung risiko telat.
        </p>
      </section>

      <section className="card p-4 md:p-5">
        <h2 className="text-sm font-bold text-slate-900">3. Deadline &amp; harga</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div>
            <label className="label">Tanggal harus jadi</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
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
          <div className="md:col-span-4">
            <label className="label">Catatan (finishing, bahan, desain dari pelanggan, dll)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} />
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Menyimpan…" : "💾 Simpan & Mulai Pantau"}
        </button>
        <button type="button" onClick={() => router.push("/pesanan")} className="btn-ghost">
          Batal
        </button>
      </div>
    </form>
  );
}

function defaultDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
