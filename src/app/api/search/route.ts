import { getCurrentUser } from "@/lib/auth";
import { problemResponse } from "@/lib/dbcheck";
import { getInvoiceAccess } from "@/lib/invoice-access";
import { quickSearch } from "@/lib/search-queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=...  -> pencarian cepat untuk tombol cari di header.
 * Hanya untuk pengguna yang login (Owner dan Karyawan). proxy.ts sudah
 * menolak permintaan tanpa login; di sini diperiksa sekali lagi.
 *
 * Dokumen ikut dicari, tapi HANYA kalau penggunanya punya izin
 * invoice. Izinnya dibaca di sini, lalu diteruskan ke quickSearch.
 * Penyaringan dan pencarian result-nya berdua di server pada satu
 * tempat, bukan setengah di route dan setengah lagi di klien -
 * kalau penyaringannya ada di sisi klien, cukup satu permintaan
 * untuk melihat data yang seharusnya tidak terlihat.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ ok: false, error: "Sesi login diperlukan." }, { status: 401 });
  }
  // null kalau belum login atau tidak punya izin invoice. Karena
  // user sudah dipastikan login di atas, null di sini berarti
  // memang tidak punya izin.
  const access = await getInvoiceAccess();
  const param = new URL(request.url).searchParams;
  const q = param.get("q") ?? "";
  // Filter tanggal hanya berlaku untuk dokumen. Bentuknya divalidasi di
  // sini juga (bukan hanya di quickSearch) supaya parameter yang rusak
  // tidak pernah sampai ke kueri, dan supaya parameter yang tidak
  // dikenal tidak ikut terpotong di balasan.
  //
  // Empat bentuk, semua tentang TANGGAL DOKUMEN:
  //   bulan   = "yyyy-mm"     -> satu bulan
  //   tanggal = "yyyy-mm-dd"  -> satu hari
  //   dari    = "yyyy-mm-dd"  -> awal rentang
  //   sampai  = "yyyy-mm-dd"  -> akhir rentang
  //
  // Semuanya boleh berdua; kalau lebih dari satu diisi, hasilnya
  // irisannya. Antarmuka tidak pernah mengirim lebih dari satu, tapi
  // route tidak bergantung pada itu - kalau nanti ada pemanggil lain,
  // perilakunya tetap bisa ditebak.
  const bulanParam = param.get("bulan") ?? "";
  const bulan = /^\d{4}-(0[1-9]|1[0-2])$/.test(bulanParam) ? bulanParam : "";
  const tanggalParam = param.get("tanggal") ?? "";
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(tanggalParam) ? tanggalParam : "";
  const dariParam = param.get("dari") ?? "";
  const dari = /^\d{4}-\d{2}-\d{2}$/.test(dariParam) ? dariParam : "";
  const sampaiParam = param.get("sampai") ?? "";
  const sampai = /^\d{4}-\d{2}-\d{2}$/.test(sampaiParam) ? sampaiParam : "";
  try {
    const result = await quickSearch(q, {
      canInvoice: Boolean(access),
      bulan: bulan || undefined,
      tanggal: tanggal || undefined,
      dari: dari || undefined,
      sampai: sampai || undefined,
    });
    return Response.json({ ok: true, q, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return problemResponse(error);
  }
}
