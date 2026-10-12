/**
 * Kecilkan gambar produk di perangkat sebelum diunggah (sama dengan app lama):
 * sisi terpanjang maksimal 400px, JPEG kualitas 0,72, latar putih (PNG transparan tidak jadi hitam).
 * Bila pengecilan gagal, berkas asli dipakai selama ukurannya masih wajar.
 */
export const PRODUCT_IMG_MAX = 400;
export const PRODUCT_IMG_QUALITY = 0.72;
const FALLBACK_MAX_BYTES = 600 * 1024;

export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp|gif|bmp)$/.test(file.type)) return reject(new Error("Berkas bukan gambar yang dikenali."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca berkas."));
    reader.onload = () => {
      const original = String(reader.result || "");
      if (!original.startsWith("data:image")) return reject(new Error("Berkas bukan gambar yang dikenali."));
      let done = false;
      const fallbackToOriginal = () => {
        if (done) return;
        done = true;
        if (/^data:image\/(png|jpeg|webp);/.test(original) && Math.floor(original.length * 0.75) <= FALLBACK_MAX_BYTES) resolve(original);
        else reject(new Error("Gambar tidak dapat dikecilkan dan ukurannya terlalu besar. Coba berkas lain."));
      };
      const img = new Image();
      img.onload = () => {
        if (done) return;
        try {
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (!w || !h) return fallbackToOriginal();
          const scale = Math.min(1, PRODUCT_IMG_MAX / Math.max(w, h));
          w = Math.max(1, Math.round(w * scale));
          h = Math.max(1, Math.round(h * scale));
          const cv = document.createElement("canvas");
          cv.width = w;
          cv.height = h;
          const ctx = cv.getContext("2d");
          if (!ctx) return fallbackToOriginal();
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const out = cv.toDataURL("image/jpeg", PRODUCT_IMG_QUALITY);
          if (out && out.length > 32) {
            done = true;
            resolve(out);
          } else fallbackToOriginal();
        } catch {
          fallbackToOriginal();
        }
      };
      img.onerror = () => fallbackToOriginal();
      setTimeout(fallbackToOriginal, 6000); // jaring pengaman bila onload/onerror tak pernah terpanggil
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}
