import Link from "next/link";
import { ShieldX } from "lucide-react";

/**
 * HALAMAN "TIDAK DIIZINKAN"
 * ===================================================================
 * Dipakai dua sumber, dan keduanya lewat param "dari":
 *
 * 1. src/proxy.ts untuk halaman khusus Owner (/pengaturan, /pengguna,
 *    dan seizean) ketika akunnya bukan Owner.
 * 2. Halaman Invoice (src/app/invoice/...) yang memanggil redirect()
 *    ke sini setelah getInvoiceAccess() mengembalikan null.
 *
 * Yang kedua butuh kalimat yang beda. "Role akun Anda tidak memiliki
 * izin membuka halaman ini" benar, tapi tidak menjelaskan apa yang
 * harus dilakukan - padahal untuk Invoice jawabannya jelas: minta
 * Owner menyalakan saklar "Boleh akses Invoice" di halaman Pengguna.
 * Tanpa keterangan itu, orang mengira akunnya rusak.
 *
 * Tombol "Kembali" selalu mengarah ke "/" - yang sekarang home screen,
 * bukan dashboard. Labelnya karena itu "Beranda", bukan "Dashboard".
 */
export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string }>;
}) {
  const dari = (await searchParams).dari;
  const invoice = dari === "invoice";

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="card p-8">
        <ShieldX size={44} className="mx-auto text-rose-500" />
        <h1 className="mt-3 text-xl font-bold text-[color:var(--pf-ink)]">Akses tidak diizinkan</h1>
        <p className="mt-2 text-sm text-slate-500">
          {invoice
            ? "Modul Invoice belum diaktifkan untuk akun ini. Minta Owner menyalakan saklar “Boleh akses Invoice” di halaman Pengguna."
            : "Role akun Anda tidak memiliki izin membuka halaman ini. Hubungi Owner bila akses diperlukan."}
        </p>
        <Link href="/" className="btn-primary mt-5">
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
