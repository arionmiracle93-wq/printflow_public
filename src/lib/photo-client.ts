/**
 * Kompres gambar DI BROWSER sebelum diunggah, supaya hemat kuota database
 * (foto disimpan langsung di Postgres/Neon) dan hemat kuota internet
 * pengguna saat upload dari HP.
 *
 * Dipakai bareng oleh dua tempat:
 *   - PhotoManager (kartu "Foto Pekerjaan" di halaman detail)
 *   - NewOrderPhotoPicker (form "+ Pekerjaan Baru")
 * supaya hasil kompresinya identik di mana pun foto diambil.
 */
export async function compressImage(file: File, maxEdge = 1400, quality = 0.72): Promise<Blob> {
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
