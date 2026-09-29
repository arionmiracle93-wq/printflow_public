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
      "Sesi Anda berakhir. Ini normal terjadi bila Owner baru saja mengganti password, mengubah role, atau menonaktifkan akun Anda - atau bila Anda sudah login lebih dari 12 jam. Silakan masuk lagi memakai password terbaru.",
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

  // Semua tambahan class md:... di bawah (padding/gap/text/rounded/ukuran
  // ikon lewat md:[&>svg]:...) itu MURNI pengecilan ~10% (real size, bukan
  // transform/zoom) biar senada sama kartu login yang sekarang lebih kecil
  // - lihat komentar panjang soal ini di src/app/login/page.tsx. Class
  // tanpa prefix (mobile) semuanya PERSIS tidak berubah.
  return <form onSubmit={submit} className="space-y-4 md:space-y-[0.9rem]">{alasan ? <p className="rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 py-2.5 text-xs font-medium leading-relaxed text-amber-100 md:rounded-[0.675rem] md:px-[0.675rem] md:py-[0.5625rem] md:text-[0.675rem]">{alasan}</p> : null}<div><label className="login-label md:text-[9.9px] md:mb-[0.3375rem]">Username</label><input autoFocus autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} placeholder="contoh: owner" className="login-input md:px-[0.675rem] md:py-[0.5625rem] md:text-[0.7875rem] md:rounded-[0.675rem]" /></div><div><label className="login-label md:text-[9.9px] md:mb-[0.3375rem]">Password</label><div className="relative"><input type={show ? "text" : "password"} autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="login-input pr-11 md:px-[0.675rem] md:py-[0.5625rem] md:pr-[2.475rem] md:text-[0.7875rem] md:rounded-[0.675rem]" /><button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-300/80 hover:bg-white/10 hover:text-white md:right-[0.45rem] md:rounded-[0.5rem] md:p-[0.45rem] md:[&>svg]:h-[14.4px] md:[&>svg]:w-[14.4px]" aria-label="Lihat password">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>{error ? <p className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 md:rounded-[0.675rem] md:px-[0.675rem] md:py-[0.45rem] md:text-[0.675rem]">{error}</p> : null}<button type="submit" disabled={busy} className="btn-primary w-full md:gap-[0.45rem] md:rounded-[0.675rem] md:px-[0.9rem] md:py-[0.5625rem] md:text-[0.7875rem] md:[&>svg]:h-[14.4px] md:[&>svg]:w-[14.4px]"><LogIn size={16} /> {busy ? "Memeriksa…" : "Masuk ke Print Flow"}</button>{needsBootstrap ? <Link href="/setup-akun" className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-100 md:gap-[0.3375rem] md:rounded-[0.675rem] md:px-[0.675rem] md:py-[0.45rem] md:text-[0.675rem] md:[&>svg]:h-[12.6px] md:[&>svg]:w-[12.6px]"><ShieldCheck size={14} /> Buat akun Owner pertama</Link> : null}</form>;
}
