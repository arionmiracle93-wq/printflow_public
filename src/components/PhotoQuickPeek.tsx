"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, ImageIcon, X } from "lucide-react";
import { photoKindLabel, type PhotoItem } from "@/lib/photos";

/** Popup foto memakai Portal ke document.body agar tidak terpengaruh transform/hover card. */
export function PhotoQuickPeek({
  orderId,
  code,
  count,
  tone = "indigo",
}: {
  orderId: number;
  code: string;
  count: number;
  tone?: "indigo" | "slate";
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<PhotoItem | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (zoom) setZoom(null);
        else setOpen(false);
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", escape);
    };
  }, [open, zoom]);

  async function load(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
    if (photos) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/photos`);
      const json = (await res.json()) as { ok: boolean; data?: PhotoItem[] };
      setPhotos(json.ok && json.data ? json.data : []);
      if (!json.ok) setError("Gagal memuat foto.");
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  if (count <= 0) return null;

  const modal = open ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto pekerjaan ${code}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          setOpen(false);
          setZoom(null);
        }
      }}
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-[#021c29]/90 p-4 pt-10 backdrop-blur-sm"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,.35)]">
        <div className="flex items-center justify-between gap-2 border-b border-teal-100 bg-[#07384f] px-4 py-3 text-white">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/25 text-teal-200"><ImageIcon size={18} /></span>
            <div><p className="text-sm font-extrabold">Foto Pekerjaan</p><p className="text-[11px] text-cyan-100/65">{code} · {count} lampiran</p></div>
          </div>
          <button type="button" onClick={() => { setOpen(false); setZoom(null); }} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20" aria-label="Tutup popup">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          {loading ? <div className="flex items-center gap-2 py-8 text-sm font-semibold text-teal-700"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-teal-500" /> Memuat foto…</div> : null}
          {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          {photos && photos.length === 0 && !loading ? <p className="py-8 text-center text-sm text-slate-400">Belum ada foto terlampir.</p> : null}
          {photos && photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((p) => (
                <button key={p.id} type="button" onClick={() => setZoom(p)} className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-teal-300 hover:shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption ?? "Foto pekerjaan"} className="h-32 w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" />
                  <div className="p-2.5"><span className="chip border-teal-100 bg-teal-50 text-[10px] text-teal-700">{photoKindLabel(p.kind)}</span>{p.caption ? <p className="mt-1.5 line-clamp-2 text-[11px] text-slate-600">{p.caption}</p> : null}</div>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <a href={`/pesanan/${orderId}`} className="inline-flex items-center gap-1.5 text-xs font-extrabold text-teal-700 hover:underline">Buka halaman pekerjaan <ExternalLink size={13} /></a>
        </div>
      </div>
    </div>
  ) : null;

  const zoomModal = zoom ? (
    <div role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) setZoom(null); }} className="fixed inset-0 z-[110] flex flex-col items-center justify-center gap-3 bg-[#01131d]/95 p-4 backdrop-blur-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={zoom.url} alt={zoom.caption ?? "Foto pekerjaan"} className="max-h-[76vh] max-w-full rounded-xl object-contain shadow-2xl" />
      <p className="max-w-md text-center text-xs font-semibold text-white">{photoKindLabel(zoom.kind)}{zoom.caption ? ` — ${zoom.caption}` : ""}</p>
      <div className="flex gap-2">
        <a href={`${zoom.url}?download=1`} className="btn-primary"><Download size={15} /> Unduh</a>
        <button type="button" onClick={() => setZoom(null)} className="btn border border-white/25 bg-white/10 text-white hover:bg-white/20"><X size={15} /> Tutup</button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button type="button" onClick={load} title={`${count} foto terlampir — klik untuk melihat`} className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold transition ${tone === "indigo" ? "bg-teal-50 text-teal-700 hover:bg-teal-100" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
        <ImageIcon size={11} /> {count}
      </button>
      {mounted && modal ? createPortal(modal, document.body) : null}
      {mounted && zoomModal ? createPortal(zoomModal, document.body) : null}
    </>
  );
}
