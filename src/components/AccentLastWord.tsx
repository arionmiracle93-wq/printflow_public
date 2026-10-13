/**
 * Nama usaha dengan kata terakhir memakai warna aksen, mengikuti gaya kop
 * dokumen di gambar acuan: "Pamulang Printing" -> "Pamulang" biasa,
 * "Printing" teal. Dipakai di sidebar, kop editor, dan halaman tampilan
 * supaya ketiganya konsisten.
 *
 * Nama satu kata tidak dipecah (tidak ada bagian "akhir" yang layak
 * dibedakan).
 */
export function AccentLastWord({ text }: { text: string }) {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return <>{text}</>;
  const last = parts[parts.length - 1];
  return (
    <>
      {parts.slice(0, -1).join(" ")} <span className="ppi-accent-word">{last}</span>
    </>
  );
}