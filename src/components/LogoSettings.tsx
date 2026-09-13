"use client";

import { useRef, useState } from "react";
import { ImagePlus, RotateCcw, Upload } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export function LogoSettings({ hasLogo }: { hasLogo: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [exists, setExists] = useState(hasLogo);
  const [version, setVersion] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/branding/logo", { method: "POST", body: form });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setMessage({ ok: false, text: json.error ?? "Gagal mengunggah logo." });
        return;
      }
      setExists(true);
      setVersion(Date.now());
      setMessage({ ok: true, text: "Logo berhasil disimpan. Muat ulang halaman untuk melihatnya di header." });
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setMessage({ ok: false, text: "Tidak dapat mengunggah logo. Periksa koneksi internet." });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Hapus logo usaha dan kembali memakai ikon robot?")) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/branding/logo", { method: "DELETE" });
      if (!res.ok) {
        setMessage({ ok: false, text: "Gagal menghapus logo." });
        return;
      }
      setExists(false);
      setMessage({ ok: true, text: "Logo dihapus. Ikon robot akan dipakai kembali setelah halaman dimuat ulang." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card min-w-0 max-w-full overflow-hidden p-4">
      <div className="flex items-start gap-3">
        <span className="icon-tile"><ImagePlus size={18} /></span>
        <div className="min-w-0">
          <h3 className="break-words text-sm font-extrabold text-[#07384f]">Logo Usaha</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Logo tampil di pojok kiri atas, menggantikan ikon robot. Gunakan logo persegi/transparan agar hasilnya rapi.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-teal-100 bg-teal-50/50 p-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm">
          {exists ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/branding/logo?v=${version}`} alt="Logo usaha saat ini" className="h-full w-full object-contain p-1.5" />
          ) : (
            <BrandMark />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-700">{exists ? "Logo usaha sedang aktif" : "Belum ada logo — ikon robot dipakai"}</p>
          <p className="mt-1 text-[11px] text-slate-500">PNG, JPG, atau WEBP · maksimal 2 MB · saran ukuran 512×512 px.</p>
        </div>
      </div>

      <div className="mt-3 grid min-w-0 gap-2 sm:flex sm:flex-wrap">
        <label className="btn-primary w-full cursor-pointer sm:w-auto">
          <Upload size={15} /> {busy ? "Memproses…" : exists ? "Ganti Logo" : "Upload Logo"}
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={busy} onChange={(e) => void upload(e.target.files?.[0])} />
        </label>
        {exists ? <button type="button" onClick={remove} disabled={busy} className="btn-ghost w-full sm:w-auto"><RotateCcw size={15} /> Kembali ke Ikon Robot</button> : null}
        {exists ? <button type="button" onClick={() => window.location.reload()} className="btn-secondary w-full sm:w-auto">Muat Ulang Header</button> : null}
      </div>

      {message ? <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${message.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{message.text}</p> : null}
    </div>
  );
}
