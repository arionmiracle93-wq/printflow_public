"use client";

import Link from "next/link";
import { Gauge, RefreshCw, ServerCrash, Stethoscope } from "lucide-react";
import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-rose-500 to-rose-600 px-5 py-4 text-white">
          <h1 className="flex items-center gap-2 text-xl font-extrabold">
            <ServerCrash size={22} strokeWidth={2.3} /> Terjadi kendala di aplikasi
          </h1>
          <p className="mt-1 text-sm text-rose-50">
            Jangan khawatir — data Anda tetap aman di database. Coba langkah di bawah ini.
          </p>
        </div>
        <div className="space-y-3 p-5">
          <ol className="space-y-2 text-sm text-slate-700">
            <li>1. Klik tombol <strong>Coba Lagi</strong> di bawah.</li>
            <li>2. Kalau masih error, buka <Link href="/status" className="font-bold text-indigo-600 underline">Halaman Diagnosis</Link> untuk mengetahui penyebabnya.</li>
            <li>3. Kalau pesannya menyebut <code className="rounded bg-slate-100 px-1">DATABASE_URL</code>, isi variable itu di Vercel → Settings → Environment Variables, lalu <strong>Redeploy</strong>.</li>
            <li>4. Kalau pesannya menyebut <code className="rounded bg-slate-100 px-1">relation ... does not exist</code>, buka <code className="rounded bg-slate-100 px-1">/api/setup</code> di browser.</li>
          </ol>
          {error.digest ? (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Kode galat: <code>{error.digest}</code> (lampirkan kode ini bila meminta bantuan)
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={reset} className="btn-primary inline-flex items-center gap-1.5">
              <RefreshCw size={15} /> Coba Lagi
            </button>
            <Link href="/" className="btn-ghost inline-flex items-center gap-1.5">
              <Gauge size={15} /> Ke Dashboard
            </Link>
            <Link href="/status" className="btn-ghost inline-flex items-center gap-1.5">
              <Stethoscope size={15} /> Diagnosis
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
