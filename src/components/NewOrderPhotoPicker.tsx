"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ClipboardPaste, ImagePlus, X } from "lucide-react";
import { compressImage } from "@/lib/photo-client";
import { formatBytes, MAX_PHOTOS_PER_ORDER, PHOTO_KINDS, photoKindLabel } from "@/lib/photos";

/**
 * Satu foto yang SUDAH dipilih & dikompres di form, tapi BELUM diunggah ke
 * server — sebab pekerjaannya sendiri belum tersimpan, jadi belum ada
 * orderId untuk ditempeli foto (order_items butuh order_id).
 *
 * `blob` disimpan di memori (bukan base64 di React state) supaya ringan;
 * `previewUrl` adalah bungkusnya lewat URL.createObjectURL untuk ditampilkan.
 */
export type PendingPhoto = {
  localId: string;
  blob: Blob;
  previewUrl: string;
  kind: string;
  caption: string;
  sizeBytes: number;
};

/**
 * PICKER FOTO DI FORM "+ PEKERJAAN BARU"
 * ----------------------------------------------------------------
 * Sengaja dibuat komponen TERPISAH dari PhotoManager (bukan dipakai ulang
 * langsung), karena beda tugas:
 *   - PhotoManager   : orderId sudah ada → tiap foto LANGSUNG diunggah.
 *   - Komponen ini   : orderId belum ada → foto cuma disiapkan di memori
 *                      browser, baru benar-benar dikirim ke server oleh
 *                      NewOrderForm setelah pekerjaannya berhasil dibuat.
 *
 * Cara pakai, kompresi, dan pilihan (kamera/galeri/paste) dibuat semirip
 * mungkin dengan PhotoManager supaya tidak terasa seperti fitur berbeda.
 */
export function NewOrderPhotoPicker({
  photos,
  onChange,
  disabled = false,
  max = MAX_PHOTOS_PER_ORDER,
}: {
  photos: PendingPhoto[];
  onChange: (photos: PendingPhoto[]) => void;
  disabled?: boolean;
  max?: number;
}) {
  const [kind, setKind] = useState<string>("referensi");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteFocused, setPasteFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const remaining = max - photos.length;

  // Selalu pegang daftar foto TERBARU lewat ref, supaya cleanup di bawah
  // (yang cuma boleh jalan sekali, saat komponen benar-benar dilepas) tidak
  // membersihkan array kosong dari render pertama.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  // Kalau form ditinggal (batal, atau pindah halaman setelah berhasil
  // simpan), lepas semua URL preview dari memori browser supaya tidak bocor.
  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  async function addFiles(files: File[]) {
    if (!files.length) return;
    setError(null);
    if (remaining <= 0) {
      setError(`Maksimal ${max} foto per pekerjaan sudah tercapai.`);
      return;
    }

    setBusy(true);
    const picked = files.slice(0, remaining);
    const added: PendingPhoto[] = [];
    for (const file of picked) {
      if (!file.type.startsWith("image/")) {
        setError(`"${file.name}" bukan berkas gambar, dilewati.`);
        continue;
      }
      try {
        const blob = await compressImage(file);
        added.push({
          localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          blob,
          previewUrl: URL.createObjectURL(blob),
          kind,
          caption: caption.trim(),
          sizeBytes: blob.size,
        });
      } catch {
        setError(`Gagal memproses "${file.name}".`);
      }
    }

    if (added.length) {
      onChange([...photos, ...added]);
      setCaption("");
      if (inputRef.current) inputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
    setBusy(false);
  }

  async function pasteFromEvent(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item, index) => {
        const blob = item.getAsFile();
        if (!blob) return null;
        return new File([blob], `clipboard-baru-${Date.now()}-${index}.png`, { type: blob.type || "image/png" });
      })
      .filter((file): file is File => file !== null);
    if (!imageFiles.length) {
      setError("Clipboard tidak berisi gambar. Ambil screenshot dulu, lalu klik kotak dan tekan Ctrl+V.");
      return;
    }
    await addFiles(imageFiles);
  }

  function remove(localId: string) {
    const target = photos.find((p) => p.localId === localId);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(photos.filter((p) => p.localId !== localId));
  }

  return (
    <div>
      {remaining > 0 ? (
        <div className="space-y-2.5 rounded-xl bg-slate-50 p-3 dark:bg-white/[0.04]">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="label">Jenis foto</label>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="input" disabled={disabled}>
                {PHOTO_KINDS.map((k) => (
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
                placeholder="Contoh: desain dari pelanggan"
                className="input"
                disabled={disabled}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <label className={`btn-primary cursor-pointer ${disabled || busy ? "pointer-events-none opacity-60" : ""}`}>
              <Camera size={15} /> Ambil Foto
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
                disabled={disabled || busy}
              />
            </label>
            <label className={`btn-ghost cursor-pointer ${disabled || busy ? "pointer-events-none opacity-60" : ""}`}>
              <ImagePlus size={15} /> Pilih dari Galeri
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
                disabled={disabled || busy}
              />
            </label>
          </div>

          <div
            role="button"
            tabIndex={0}
            onPaste={pasteFromEvent}
            onFocus={() => setPasteFocused(true)}
            onBlur={() => setPasteFocused(false)}
            className={`cursor-text rounded-xl border-2 border-dashed px-4 py-3 text-center outline-none transition ${
              pasteFocused
                ? "border-teal-500 bg-teal-50 ring-4 ring-teal-100"
                : "border-slate-200 bg-white hover:border-teal-300 dark:border-white/10 dark:bg-transparent"
            }`}
          >
            <ClipboardPaste size={16} className="mx-auto text-teal-600" />
            <p className="mt-1 text-[11px] font-extrabold text-[#07384f] dark:text-slate-200">
              Klik kotak ini, lalu tekan Ctrl + V untuk tempel screenshot
            </p>
          </div>

          {busy ? <p className="text-xs font-semibold text-indigo-600">Memproses gambar…</p> : null}
          {error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
          Maksimal {max} foto per pekerjaan sudah tercapai.
        </p>
      )}

      {photos.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <div
              key={p.localId}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt={p.caption || "Foto pekerjaan"} className="h-20 w-full object-cover sm:h-24" />
              <button
                type="button"
                onClick={() => remove(p.localId)}
                disabled={disabled}
                title="Batal lampirkan foto ini"
                className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white transition hover:bg-rose-600 disabled:opacity-40"
              >
                <X size={12} />
              </button>
              <span className="absolute bottom-1 left-1 rounded-full bg-slate-900/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
                {photoKindLabel(p.kind)}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        {photos.length}/{max} foto siap dilampirkan
        {photos.length > 0 ? ` (${formatBytes(photos.reduce((s, p) => s + p.sizeBytes, 0))})` : ""} — benar-benar
        terunggah begitu tombol Simpan di bawah ditekan.
      </p>
    </div>
  );
}
