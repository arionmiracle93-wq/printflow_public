"use client";

import { Select } from "@/components/Select";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Handshake, Send, UserRoundCheck } from "lucide-react";
import { statusMeta } from "@/lib/domain";
import type { HandoverCandidate } from "@/lib/handover-queries";
import type { EmployeeOption } from "@/lib/user-queries";

/**
 * BUAT SERAH TERIMA LANGSUNG DARI HALAMAN SHIFT
 * ---------------------------------------------------------------
 * Sebelumnya serah terima hanya bisa dibuat dari tab Komunikasi di detail
 * pekerjaan, dan halaman Shift cuma menampilkan daftar yang menunggu.
 * Komponen ini menambahkan jalur kedua: pilih pekerjaan di sini, isi
 * form, selesai - tanpa bolak-balik ke detail pekerjaan.
 *
 * Isi form dan aturannya SAMA dengan HandoverManager (tab Komunikasi) dan
 * keduanya memakai API yang sama (POST /api/orders/[id]/handovers), jadi
 * validasi, notifikasi push, dan catatan riwayat tidak ada yang berbeda.
 */

const EMPTY_FORM = {
  fromOperator: "",
  toUserId: "",
  shiftLabel: "Shift Berikutnya",
  lastPosition: "",
  blocker: "",
  nextAction: "",
  note: "",
};

export function ShiftHandoverCreator({
  candidates,
  employees,
  loggedInName,
  loggedInRole,
}: {
  candidates: HandoverCandidate[];
  employees: EmployeeOption[];
  loggedInName: string;
  loggedInRole: string;
}) {
  const router = useRouter();
  const isOwner = loggedInRole === "owner";
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<ReactNode | null>(null);

  // Pekerjaan yang PIC-nya akun ini ditaruh paling atas supaya cepat ketemu.
  const sorted = useMemo(() => {
    const me = loggedInName.trim().toLocaleLowerCase("id-ID");
    const mine = (c: HandoverCandidate) => (c.operator ?? "").trim().toLocaleLowerCase("id-ID") === me;
    return [...candidates].sort((a, b) => Number(mine(b)) - Number(mine(a)));
  }, [candidates, loggedInName]);

  const selected = candidates.find((c) => String(c.id) === orderId) ?? null;

  function pickOrder(value: string) {
    setOrderId(value);
    const order = candidates.find((c) => String(c.id) === value);
    if (!order) return;
    // Isi awal dari pekerjaan terpilih. Owner boleh mengubah "dari operator",
    // karyawan selalu atas nama akunnya sendiri (API juga memaksa begini).
    setForm((prev) => ({
      ...prev,
      fromOperator: isOwner ? order.operator ?? loggedInName : loggedInName,
      lastPosition: `Status ${statusMeta(order.status).label}`,
    }));
  }

  function close() {
    setOpen(false);
    setOrderId("");
    setForm(EMPTY_FORM);
  }

  async function submit() {
    if (!selected) {
      setMessage("Pilih pekerjaan yang mau diserahkan terlebih dahulu.");
      return;
    }
    if (!form.toUserId) {
      setMessage("Pilih Karyawan tujuan terlebih dahulu.");
      return;
    }
    if (!form.lastPosition.trim() || !form.nextAction.trim()) {
      setMessage("Posisi terakhir dan tindakan berikutnya wajib diisi.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${selected.id}/handovers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (json.ok) {
        setMessage(
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={13} className="shrink-0" /> Serah terima {selected.code} dibuat. Karyawan tujuan dan Owner akan menerima notifikasi jika push aktif.
          </span>,
        );
        close();
        window.dispatchEvent(new Event("handover-count-changed"));
        router.refresh();
      } else {
        setMessage(json.error ?? "Gagal menyimpan.");
      }
    } catch {
      setMessage("Koneksi bermasalah. Coba lagi sebentar.");
    }
    setBusy(false);
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="icon-tile"><Handshake size={18} /></span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[color:var(--pf-ink)]">Buat Serah Terima Baru</h2>
            <p className="text-[11px] text-slate-500">Pilih pekerjaan, isi catatan, lalu serahkan ke karyawan shift berikutnya.</p>
          </div>
        </div>
        {!open ? (
          <button type="button" onClick={() => { setOpen(true); setMessage(null); }} className="btn-secondary">
            <Send size={14} /> Buat Serah Terima
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="space-y-3 border-t border-slate-100 p-4">
          {candidates.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Tidak ada pekerjaan aktif yang bisa diserahkan. Pekerjaan yang sudah punya serah terima menunggu tidak ditampilkan di sini.
            </p>
          ) : null}
          {employees.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Belum ada akun Karyawan aktif lain. Owner perlu membuat/mengaktifkan akun Karyawan melalui Kelola Pengguna.
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Pekerjaan yang diserahkan">
                <Select value={orderId} onChange={(event) => pickOrder(event.target.value)} className="input" disabled={!candidates.length}>
                  <option value="">Pilih pekerjaan…</option>
                  {sorted.map((c) => (
                    <option key={c.id} value={c.id}>
                      {`${c.code} · ${c.title} — ${c.customerName}${c.operator ? ` · PIC ${c.operator}` : ""}`}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Dari operator">
              <input value={form.fromOperator} disabled={!isOwner} onChange={(event) => setForm({ ...form, fromOperator: event.target.value })} className="input disabled:bg-slate-100" />
            </Field>
            <Field label="Kepada Karyawan">
              <Select value={form.toUserId} onChange={(event) => setForm({ ...form, toUserId: event.target.value })} className="input" disabled={!employees.length}>
                <option value="">Pilih akun Karyawan…</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name} (@{employee.username})</option>
                ))}
              </Select>
            </Field>
            <Field label="Nama shift">
              <Select value={form.shiftLabel} onChange={(event) => setForm({ ...form, shiftLabel: event.target.value })} className="input">
                <option>Shift Pagi</option><option>Shift Siang</option><option>Shift Malam</option><option>Shift Berikutnya</option>
              </Select>
            </Field>
            <Field label="Posisi terakhir">
              <input value={form.lastPosition} onChange={(event) => setForm({ ...form, lastPosition: event.target.value })} className="input" />
            </Field>
            <Field label="Tindakan berikutnya (wajib)">
              <textarea rows={2} value={form.nextAction} onChange={(event) => setForm({ ...form, nextAction: event.target.value })} placeholder="Contoh: lanjut cetak 300 lembar, lalu cek warna" className="input" />
            </Field>
            <Field label="Kendala / perhatian">
              <textarea rows={2} value={form.blocker} onChange={(event) => setForm({ ...form, blocker: event.target.value })} placeholder="Contoh: tinta cyan hampir habis" className="input" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Catatan tambahan"><textarea rows={2} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="input" /></Field>
            </div>
          </div>
          <div className="grid gap-2 sm:flex">
            <button type="button" onClick={submit} disabled={busy || !employees.length || !selected || !form.toUserId} className="btn-primary">
              <UserRoundCheck size={14} /> {busy ? "Menyimpan…" : "Serahkan ke Karyawan"}
            </button>
            <button type="button" onClick={() => { close(); setMessage(null); }} className="btn-ghost">Batal</button>
          </div>
        </div>
      ) : null}

      {message ? <p className="mx-4 mb-4 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{message}</p> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="min-w-0"><span className="label">{label}</span>{children}</label>;
}
