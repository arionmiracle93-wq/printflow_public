"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, ClipboardPaste, ImagePlus } from "lucide-react";
import { MAX_PHOTOS_PER_ORDER, photoKindLabel, type PhotoItem } from "@/lib/photos";

const KINDS = ["referensi", "hasil", "nota"] as const;

/** Perkecil gambar di HP sebelum dikirim supaya hemat kuota database & kuota internet. */
async function compressImage(file: File, maxEdge = 1400, quality = 0.72): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    return await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob && blob.size < file.size ? blob : file),
        "image/jpeg",
        quality,
      );
    });
  } catch {
    return file;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PhotoManager({
  orderId,
  initialPhotos,
  max = 8,
}: {
  orderId: number;
  initialPhotos: PhotoItem[];
  max?: number;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState<PhotoItem[]>(initialPhotos);
  const [kind, setKind] = useState<string>("referensi");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<PhotoItem | null>(null);
  const [pasteFocused, setPasteFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const remaining = max - photos.length;

  async function handleFiles(inputFiles: File[]) {
    if (!inputFiles.length) return;
    setError(null);

    if (remaining <= 0) {
      setError(`Batas ${max} foto per pekerjaan sudah tercapai. Hapus salah satu dulu.`);
      return;
    }

    setBusy(true);
    const files = inputFiles.slice(0, remaining);
    const uploaded: PhotoItem[] = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      setProgress(`Memperkecil & mengunggah foto ${i + 1} dari ${files.length}…`);
      if (!file.type.startsWith("image/")) {
        setError(`"${file.name}" bukan berkas gambar, dilewati.`);
        continue;
      }
      try {
        const blob = await compressImage(file);
        const form = new FormData();
        form.append("files", new File([blob], `foto-${orderId}-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" }));
        form.append("kind", kind);
        if (caption.trim()) form.append("caption", caption.trim());

        const res = await fetch(`/api/orders/${orderId}/photos`, { method: "POST", body: form });
        const json = (await res.json()) as { ok: boolean; data?: PhotoItem[]; error?: string };
        if (!json.ok || !json.data) {
          setError(json.error ?? "Gagal mengunggah foto.");
          continue;
        }
        uploaded.push(...json.data);
      } catch {
        setError("Tidak dapat mengunggah. Periksa koneksi internet Anda.");
      }
    }

    if (uploaded.length) {
      setPhotos((prev) => [...prev, ...uploaded]);
      setCaption("");
      if (inputRef.current) inputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      router.refresh();
    }
    setBusy(false);
    setProgress(null);
  }

  async function pasteFromEvent(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item, index) => {
        const blob = item.getAsFile();
        if (!blob) return null;
        return new File([blob], `clipboard-${orderId}-${Date.now()}-${index}.png`, { type: blob.type || "image/png" });
      })
      .filter((file): file is File => file !== null);
    if (!imageFiles.length) {
      setError("Clipboard tidak berisi gambar. Ambil screenshot dulu, lalu klik kotak dan tekan Ctrl+V.");
      return;
    }
    await handleFiles(imageFiles);
  }

  async function readClipboard() {
    setError(null);
    try {
      if (!navigator.clipboard?.read) {
        setError("Browser ini tidak mengizinkan tombol Baca Clipboard. Gunakan cara: klik kotak lalu tekan Ctrl+V.");
        return;
      }
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        files.push(new File([blob], `clipboard-${orderId}-${Date.now()}.png`, { type: imageType }));
      }
      if (!files.length) setError("Clipboard tidak berisi gambar.");
      else await handleFiles(files);
    } catch {
      setError("Akses clipboard ditolak browser. Klik kotak paste lalu tekan Ctrl+V pada keyboard.");
    }
  }

  async function remove(photo: PhotoItem) {
    if (!confirm("Hapus foto ini?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/photos/${photo.id}`, { method: "DELETE" });
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
        router.refresh();
      } else {
        setError("Gagal menghapus foto.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">🖼️ Foto Pekerjaan</h3>
          <p className="text-xs text-slate-500">
            Supaya pekerjaan bernama mirip mudah dibedakan: lampirkan desain, hasil jadi, atau nota.
          </p>
        </div>
        <span className="chip border-slate-200 bg-slate-50 text-slate-600">
          {photos.length}/{max} foto
        </span>
      </div>

      {/* FORM UPLOAD */}
      {remaining > 0 ? (
        <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="label">Jenis foto</label>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="input">
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {photoKindLabel(k)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Keterangan (opsional)</label>
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Contoh: versi revisi 2, warna merah"
                className="input"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="btn-primary cursor-pointer">
              <Camera size={15} /> Ambil Foto
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
                disabled={busy}
              />
            </label>
            <label className="btn-ghost cursor-pointer">
              <ImagePlus size={15} /> Pilih dari Galeri
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
                disabled={busy}
              />
            </label>
            <button type="button" onClick={readClipboard} disabled={busy} className="btn-ghost">
              <ClipboardPaste size={15} /> Baca Clipboard
            </button>
          </div>

          <div
            role="button"
            tabIndex={0}
            onPaste={pasteFromEvent}
            onFocus={() => setPasteFocused(true)}
            onBlur={() => setPasteFocused(false)}
            className={`cursor-text rounded-xl border-2 border-dashed px-4 py-4 text-center outline-none transition ${
              pasteFocused ? "border-teal-500 bg-teal-50 ring-4 ring-teal-100" : "border-slate-200 bg-white hover:border-teal-300"
            }`}
          >
            <ClipboardPaste size={20} className="mx-auto text-teal-600" />
            <p className="mt-1.5 text-xs font-extrabold text-[#07384f]">Klik kotak ini, lalu tekan Ctrl + V</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Screenshot dari Windows clipboard akan langsung dikompres dan diunggah.</p>
          </div>
          <p className="text-[10px] text-slate-400">Foto otomatis diperkecil agar hemat kuota. Paste didukung di Chrome, Edge, dan browser modern.</p>

          {busy ? (
            <p className="text-xs font-semibold text-indigo-600">{progress ?? "Memproses…"}</p>
          ) : null}
          {error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
          Batas {max} foto sudah tercapai. Hapus salah satu bila ingin menambah.
        </p>
      )}

      {/* GALERI */}
      {photos.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
          Belum ada foto. Ketuk tombol di atas untuk menambahkan.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button type="button" onClick={() => setLightbox(photo)} className="block w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption ?? "Foto pekerjaan"}
                  className="h-28 w-full object-cover sm:h-32"
                  loading="lazy"
                />
              </button>
              <div className="p-2">
                <span className="chip border-indigo-200 bg-indigo-50 text-[10px] text-indigo-700">
                  {photoKindLabel(photo.kind)}
                </span>
                {photo.caption ? (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-tight text-slate-600">{photo.caption}</p>
                ) : null}
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{formatSize(photo.sizeBytes)}</span>
                  <button
                    type="button"
                    onClick={() => remove(photo)}
                    disabled={busy}
                    className="font-bold text-rose-500 hover:underline"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LIGHTBOX */}
      {lightbox ? (
        <div
          role="presentation"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-slate-900/90 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.caption ?? "Foto pekerjaan"}
            className="max-h-[78vh] max-w-full rounded-xl object-contain"
          />
          <p className="max-w-md text-center text-xs font-semibold text-white">
            {photoKindLabel(lightbox.kind)}
            {lightbox.caption ? ` — ${lightbox.caption}` : ""}
          </p>
          <div className="flex gap-2">
            <a href={`${lightbox.url}?download=1`} className="btn bg-white text-slate-800">
              ⬇️ Unduh
            </a>
            <button type="button" onClick={() => setLightbox(null)} className="btn-ghost">
              ✕ Tutup
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
