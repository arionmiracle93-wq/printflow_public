import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <div className="card p-8">
        <p className="text-5xl">🧭</p>
        <h1 className="mt-3 text-xl font-extrabold text-slate-900">Halaman tidak ditemukan (404)</h1>
        <p className="mt-1 text-sm text-slate-600">
          Alamat yang Anda buka salah ketik, atau pekerjaannya sudah dihapus.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn-primary">
            🏠 Ke Dashboard
          </Link>
          <Link href="/pesanan" className="btn-ghost">
            📋 Daftar Pekerjaan
          </Link>
          <Link href="/status" className="btn-ghost">
            🩺 Diagnosis
          </Link>
        </div>
      </div>
    </div>
  );
}
