/**
 * QRIS & KODE UNIK TRANSFER (diporting PERSIS dari app invoice lama)
 * Kode murni - aman dipakai di server maupun layar.
 *
 *  - QRIS statis (payload dari merchant) diubah jadi QRIS dinamis dengan
 *    nominal tertanam: tag 01 jadi "12", tag 54 (nominal) diganti/ditambah
 *    sebelum tag 58, lalu CRC16 dihitung ulang.
 *  - Kode unik transfer: angka 1-899 yang STABIL dari nomor dokumen
 *    (hash FNV-1a), supaya cetak ulang tidak mengubah nominal transfer.
 */

/** CRC16-CCITT (poly 0x1021, awal 0xFFFF) sesuai standar EMVCo QRIS. */
export function qrisCRC(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i += 1) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

type Tag = { id: string; value: string };

/** Pecah payload EMVCo menjadi daftar {id, value} tingkat atas. */
export function qrisParse(payload: string): Tag[] | null {
  const out: Tag[] = [];
  const s = String(payload || "");
  let i = 0;
  while (i + 4 <= s.length) {
    const id = s.substr(i, 2);
    const len = parseInt(s.substr(i + 2, 2), 10);
    if (Number.isNaN(len) || len < 0) return null;
    const value = s.substr(i + 4, len);
    if (value.length < len) return null;
    out.push({ id, value });
    i += 4 + len;
  }
  return i === s.length ? out : null;
}

function tlv(id: string, value: string): string {
  return id + String(value.length).padStart(2, "0") + value;
}

export type QrisCheck =
  | { ok: true; merchant: string; city: string; raw: string }
  | { ok: false; msg: string };

function checkRaw(raw: string): QrisCheck {
  if (!raw) return { ok: false, msg: "Payload kosong" };
  if (raw.length < 40) return { ok: false, msg: "Payload terlalu pendek — pastikan seluruh teks QR tersalin" };
  const tags = qrisParse(raw);
  if (!tags) return { ok: false, msg: "Struktur TLV tidak valid — kemungkinan teks terpotong" };
  const get = (id: string) => tags.find((t) => t.id === id)?.value ?? null;
  if (get("00") === null) return { ok: false, msg: "Tag 00 (format indicator) tidak ditemukan" };
  if (get("63") === null) return { ok: false, msg: "Tag 63 (CRC) tidak ditemukan" };
  const idx = raw.lastIndexOf("6304");
  if (idx === -1) return { ok: false, msg: "Penanda CRC tidak ditemukan" };
  const expect = qrisCRC(raw.substring(0, idx + 4));
  const actual = raw.substring(idx + 4, idx + 8).toUpperCase();
  if (expect !== actual) return { ok: false, msg: `CRC tidak cocok (${actual} ≠ ${expect}) — teks mungkin salah salin` };
  return { ok: true, merchant: get("59") || "", city: get("60") || "", raw };
}

/**
 * Validasi payload QRIS statis (struktur TLV + CRC bawaan).
 * PERBAIKAN dari app lama: app lama membuang SEMUA spasi sehingga QRIS dengan
 * nama merchant berspasi ("WARUNG MAKAN ...") ditolak. Di sini spasi di dalam
 * payload dipertahankan; hanya baris baru/tab yang dibuang. Kalau cara itu gagal,
 * dicoba lagi dengan semua spasi dibuang (perilaku lama) supaya payload yang
 * tersalin dengan spasi nyasar tetap bisa dipakai.
 */
export function qrisValidate(payload: string): QrisCheck {
  const source = String(payload || "");
  const strict = checkRaw(source.trim().replace(/[\r\n\t]+/g, ""));
  if (strict.ok) return strict;
  const loose = checkRaw(source.replace(/\s+/g, ""));
  return loose.ok ? loose : strict;
}

/** Ubah QRIS statis jadi dinamis dengan nominal tertentu. null bila payload tidak valid. */
export function qrisWithAmount(payload: string, amount: number): string | null {
  const v = qrisValidate(payload);
  if (!v.ok) return null;
  const amt = Math.round(Number(amount) || 0);
  if (amt <= 0) return v.raw;

  const idx = v.raw.lastIndexOf("6304");
  const body = v.raw.substring(0, idx);
  const tags = qrisParse(body);
  if (!tags) return null;

  const rebuilt: string[] = [];
  let amountInserted = false;
  tags.forEach((t) => {
    if (t.id === "01") {
      rebuilt.push(tlv("01", "12")); // jadikan dinamis
      return;
    }
    if (t.id === "54") return; // buang nominal lama
    // Nominal harus berada sebelum tag 58 (country code)
    if (!amountInserted && parseInt(t.id, 10) > 54) {
      rebuilt.push(tlv("54", String(amt)));
      amountInserted = true;
    }
    rebuilt.push(tlv(t.id, t.value));
  });
  if (!amountInserted) rebuilt.push(tlv("54", String(amt)));

  const withoutCRC = `${rebuilt.join("")}6304`;
  return withoutCRC + qrisCRC(withoutCRC);
}

/** Kode unik 1..899, deterministik dari nomor dokumen (FNV-1a). 0 bila nomor kosong. */
export function uniqueCodeFor(invNo: string): number {
  const s = String(invNo || "");
  if (!s) return 0;
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 899) + 1;
}
