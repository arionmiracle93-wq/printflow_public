"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff, LogIn, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function LoginForm() {
  const params = useSearchParams();
  const [form, setForm] = useState({ username: "", password: "" });
  const [show, setShow] = useState(false);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void fetch("/api/auth/status").then((r) => r.json()).then((j) => setNeedsBootstrap(Boolean(j.needsBootstrap))).catch(() => undefined); }, []);

  // Penjelasan kenapa pengguna tiba-tiba diminta login lagi. Tanpa ini, orang
  // yang password-nya baru di-reset owner hanya terlempar ke halaman login
  // tanpa keterangan apa pun dan mengira aplikasinya rusak.
  const ALASAN: Record<string, string> = {
    "sesi-berakhir":
      "Sesi Anda berakhir. Ini normal terjadi bila Owner baru saja mengganti password, mengubah role, atau menonaktifkan akun Anda — atau bila Anda sudah login lebih dari 12 jam. Silakan masuk lagi memakai password terbaru.",
  };
  const alasan = ALASAN[params.get("alasan") ?? ""] ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!json.ok) { setError(json.error ?? "Login gagal."); setBusy(false); return; }
    const target = params.get("next");
    window.location.href = target?.startsWith("/") && !target.startsWith("//") ? target : "/";
  }

  return <form onSubmit={submit} className="space-y-4">{alasan ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-amber-900">{alasan}</p> : null}<div><label className="label">Username</label><input autoFocus autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} placeholder="contoh: owner" className="input" /></div><div><label className="label">Password</label><div className="relative"><input type={show ? "text" : "password"} autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input pr-11" /><button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Lihat password">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>{error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}<button type="submit" disabled={busy} className="btn-primary w-full"><LogIn size={16} /> {busy ? "Memeriksa…" : "Masuk ke Print Flow"}</button>{needsBootstrap ? <Link href="/setup-akun" className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"><ShieldCheck size={14} /> Buat akun Owner pertama</Link> : null}</form>;
}
