"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, Handshake, Send, UserRoundCheck } from "lucide-react";
import { statusMeta, formatDateTimeID } from "@/lib/domain";
import type { HandoverRecord } from "@/lib/handover-queries";
import type { EmployeeOption } from "@/lib/user-queries";

export function HandoverManager({
  orderId,
  currentOperator,
  orderStatus,
  records,
  loggedInName,
  loggedInRole,
  employees,
}: {
  orderId: number;
  currentOperator: string | null;
  orderStatus: string;
  records: HandoverRecord[];
  loggedInName: string;
  loggedInRole: string;
  employees: EmployeeOption[];
}) {
  const router = useRouter();
  const pending = records.find((record) => record.status === "menunggu");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    fromOperator: loggedInRole === "owner" ? currentOperator ?? loggedInName : loggedInName,
    toUserId: "",
    shiftLabel: "Shift Berikutnya",
    lastPosition: `Status ${statusMeta(orderStatus).label}`,
    blocker: "",
    nextAction: "",
    note: "",
  });
  const receiver = loggedInName;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!form.toUserId) {
      setMessage("Pilih Karyawan tujuan terlebih dahulu.");
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/orders/${orderId}/handovers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = (await res.json()) as { ok: boolean; error?: string };
    setMessage(json.ok
      ? "✅ Serah terima dibuat. Karyawan tujuan dan Owner akan menerima notifikasi jika push aktif."
      : json.error ?? "Gagal menyimpan.");
    if (json.ok) {
      setOpen(false);
      window.dispatchEvent(new Event("handover-count-changed"));
      router.refresh();
    }
    setBusy(false);
  }

  async function accept() {
    if (!pending || !receiver.trim()) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/orders/${orderId}/handovers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", handoverId: pending.id }),
    });
    const json = (await res.json()) as { ok: boolean; error?: string };
    setMessage(json.ok
      ? "✅ Pekerjaan diterima. Nama operator aktif sudah diperbarui."
      : json.error ?? "Gagal menerima.");
    if (json.ok) {
      window.dispatchEvent(new Event("handover-count-changed"));
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="icon-tile"><Handshake size={18} /></span>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-[#07384f]">Serah Terima Shift</h3>
            <p className="text-[11px] text-slate-500">Tujuan dipilih dari akun Karyawan aktif agar identitas dan push selalu tepat.</p>
          </div>
        </div>
        {!pending ? (
          <button type="button" onClick={() => setOpen(!open)} className="btn-secondary"><Send size={14} /> Buat Serah Terima</button>
        ) : (
          <span className="chip border-amber-200 bg-amber-50 text-amber-700"><Clock3 size={12} /> Menunggu diterima</span>
        )}
      </div>

      {pending ? (
        <div className="space-y-3 bg-amber-50/50 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-[#07384f]">
            <span>{pending.fromOperator}</span><ArrowRight size={15} className="text-amber-500" /><span>{pending.toOperator}</span>
            {pending.shiftLabel ? <span className="chip border-slate-200 bg-white text-slate-500">{pending.shiftLabel}</span> : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Info label="Posisi terakhir" value={pending.lastPosition} />
            <Info label="Tindakan berikutnya" value={pending.nextAction} />
            {pending.blocker ? <Info label="Kendala / perhatian" value={pending.blocker} danger /> : null}
            {pending.note ? <Info label="Catatan tambahan" value={pending.note} /> : null}
          </div>
          <p className="text-[11px] text-slate-400">Diserahkan {formatDateTimeID(pending.handedOverAt)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700">Login sebagai: {receiver}</p>
            <button type="button" onClick={accept} disabled={busy} className="btn-primary"><CheckCircle2 size={15} /> Terima sebagai {receiver}</button>
          </div>
        </div>
      ) : null}

      {open && !pending ? (
        <div className="space-y-3 p-4">
          {employees.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Belum ada akun Karyawan aktif lain. Owner perlu membuat/mengaktifkan akun Karyawan melalui Kelola Pengguna.
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Dari operator">
              <input value={form.fromOperator} disabled={loggedInRole !== "owner"} onChange={(event) => setForm({ ...form, fromOperator: event.target.value })} className="input disabled:bg-slate-100" />
            </Field>
            <Field label="Kepada Karyawan">
              <select value={form.toUserId} onChange={(event) => setForm({ ...form, toUserId: event.target.value })} className="input" disabled={!employees.length}>
                <option value="">Pilih akun Karyawan…</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name} (@{employee.username})</option>
                ))}
              </select>
            </Field>
            <Field label="Nama shift">
              <select value={form.shiftLabel} onChange={(event) => setForm({ ...form, shiftLabel: event.target.value })} className="input">
                <option>Shift Pagi</option><option>Shift Siang</option><option>Shift Malam</option><option>Shift Berikutnya</option>
              </select>
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
            <button type="button" onClick={submit} disabled={busy || !employees.length || !form.toUserId} className="btn-primary"><UserRoundCheck size={14} /> {busy ? "Menyimpan…" : "Serahkan ke Karyawan"}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Batal</button>
          </div>
        </div>
      ) : null}

      {records.some((record) => record.status === "diterima") ? (
        <details className="border-t border-slate-100 px-4 py-3">
          <summary className="cursor-pointer text-xs font-bold text-teal-700">Lihat riwayat serah terima ({records.filter((record) => record.status === "diterima").length})</summary>
          <ul className="mt-2 space-y-2">
            {records.filter((record) => record.status === "diterima").slice(0, 8).map((record) => (
              <li key={record.id} className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600">
                <strong className="text-slate-800">{record.fromOperator} → {record.acceptedBy}</strong> · {record.lastPosition}<br />
                <span className="text-slate-400">Diterima {formatDateTimeID(record.acceptedAt)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {message ? <p className="mx-4 mb-4 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{message}</p> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="min-w-0"><span className="label">{label}</span>{children}</label>;
}

function Info({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className={`rounded-xl p-3 ${danger ? "border border-rose-200 bg-rose-50" : "bg-white"}`}><p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-xs font-semibold ${danger ? "text-rose-700" : "text-slate-700"}`}>{value}</p></div>;
}
