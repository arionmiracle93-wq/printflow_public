"use client";

import Link from "next/link";
import type { DbCheck } from "@/lib/dbcheck";

export function ProblemScreen({ problem, hint }: { problem: DbCheck; hint?: string }) {
  const fatal = problem.code === "env_kosong" || problem.code === "gagal_koneksi";

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-6">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-100">Perlu disetel sekali saja</p>
          <h1 className="mt-1 text-xl font-extrabold leading-snug md:text-2xl">⚙️ {problem.title}</h1>
          <p className="mt-1 text-sm text-amber-50">{problem.message}</p>
        </div>

        <div className="space-y-4 p-5">
          {hint ? (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">ℹ️ {hint}</p>
          ) : null}

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Ikuti langkah ini satu per satu
            </p>
            <ol className="mt-2 space-y-2">
              {problem.steps.map((step, i) => (
                <li key={step} className="flex gap-2.5 text-sm text-slate-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-primary w-full"
            >
              🔄 Saya sudah perbaiki, cek lagi
            </button>
            <Link href="/status" className="btn-ghost w-full">
              🩺 Buka Halaman Diagnosis
            </Link>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-bold text-slate-900">🔎 Kondisi pengaturan saat ini</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
          <li>
            {problem.env.ada ? "✅" : "❌"} Variable <code className="rounded bg-slate-100 px-1">DATABASE_URL</code>{" "}
            {problem.env.ada ? "sudah ada" : "belum ada di server"}
          </li>
          <li>
            {problem.env.local ? "🖥️" : "☁️"} Server database:{" "}
            <code className="rounded bg-slate-100 px-1">{problem.env.host ?? "tidak diketahui"}</code>
          </li>
          <li>
            {problem.env.pakaiPooler ? "✅" : "⚠️"} Memakai koneksi{" "}
            <strong>{problem.env.pakaiPooler ? "Pooled (benar untuk Vercel)" : "Direct / tidak terdeteksi"}</strong>
          </li>
          <li>
            {problem.env.pakaiSsl ? "✅" : "⚠️"} Koneksi terenkripsi (sslmode){" "}
            {problem.env.pakaiSsl ? "sudah diaktifkan" : "belum terlihat di URL (akan diaktifkan otomatis oleh aplikasi)"}
          </li>
        </ul>
        {fatal ? (
          <p className="mt-3 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            💡 Panduan lengkap dengan gambar langkah: buka halaman{" "}
            <Link href="/panduan" className="font-bold underline">
              /panduan
            </Link>{" "}
            → bagian LANGKAH B (Neon) dan LANGKAH D2 (Vercel).
          </p>
        ) : null}
      </div>
    </div>
  );
}
