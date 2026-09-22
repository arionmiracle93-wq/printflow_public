import Link from "next/link";
import { ClipboardList, Compass, Gauge, Stethoscope } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <div className="card p-8">
        <Compass size={48} strokeWidth={1.6} className="mx-auto text-slate-300" />
        <h1 className="mt-3 text-xl font-extrabold text-slate-900">Halaman tidak ditemukan (404)</h1>
        <p className="mt-1 text-sm text-slate-600">
          Alamat yang Anda buka salah ketik, atau pekerjaannya sudah dihapus.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn-primary inline-flex items-center gap-1.5">
            <Gauge size={15} /> Ke Dashboard
          </Link>
          <Link href="/pesanan" className="btn-ghost inline-flex items-center gap-1.5">
            <ClipboardList size={15} /> Daftar Pekerjaan
          </Link>
          <Link href="/status" className="btn-ghost inline-flex items-center gap-1.5">
            <Stethoscope size={15} /> Diagnosis
          </Link>
        </div>
      </div>
    </div>
  );
}
