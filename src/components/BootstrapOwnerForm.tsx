"use client";

import { useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

export function BootstrapOwnerForm() {
  const [form, setForm] = useState({ name: "", username: "owner", password: "", confirm: "", setupToken: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (form.password !== form.confirm) { setError("Konfirmasi password tidak sama."); return; }
    setBusy(true);
    const res = await fetch("/api/auth/bootstrap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!json.ok) { setError(json.error ?? "Gagal membuat akun."); setBusy(false); return; }
    window.location.href = "/";
  }
  return <form onSubmit={submit} className="space-y-3"><div><label className="label">Nama Owner</label><input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama Anda" className="input" /></div><div><label className="label">Username</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })} className="input" /></div><div><label className="label">Password (minimal 8 karakter)</label><div className="relative"><input type={show ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input pr-11" /><button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div><div><label className="label">Ulangi Password</label><input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} className="input" /></div><div><label className="label">Setup Token (isi bila Anda memasangnya di Vercel)</label><input type="password" value={form.setupToken} onChange={(e) => setForm({ ...form, setupToken: e.target.value })} placeholder="Boleh kosong jika SETUP_TOKEN tidak dipakai" className="input" /></div>{error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}<button type="submit" disabled={busy} className="btn-primary w-full"><ShieldCheck size={16} /> {busy ? "Membuat akun…" : "Buat Akun Owner"}</button></form>;
}
