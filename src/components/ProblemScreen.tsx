"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Cloud, Info, Lightbulb, Monitor, RefreshCw, Search, Settings, Stethoscope, XCircle } from "lucide-react";
import type { DbCheck } from "@/lib/dbcheck";

export function ProblemScreen({ problem, hint }: { problem: DbCheck; hint?: string }) {
  const fatal = problem.code === "env_kosong" || problem.code === "gagal_koneksi";

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-6">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-100">Perlu disetel sekali saja</p>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-extrabold leading-snug md:text-2xl">
            <Settings size={20} strokeWidth={2.3} /> {problem.title}
          </h1>
          <p className="mt-1 text-sm text-amber-50">{problem.message}</p>
        </div>

        <div className="space-y-4 p-5">
          {hint ? (
            <p className="flex items-start gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <Info size={15} className="mt-0.5 shrink-0" /> {hint}
            </p>
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
              className="btn-primary inline-flex w-full items-center justify-center gap-1.5"
            >
              <RefreshCw size={15} /> Saya sudah perbaiki, cek lagi
            </button>
            <Link href="/status" className="btn-ghost inline-flex w-full items-center justify-center gap-1.5">
              <Stethoscope size={15} /> Buka Halaman Diagnosis
            </Link>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <Search size={16} /> Kondisi pengaturan saat ini
        </h2>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
          <li className="flex items-start gap-1.5">
            {problem.env.ada ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" /> : <XCircle size={15} className="mt-0.5 shrink-0 text-rose-600" />}
            <span>
              Variable <code className="rounded bg-slate-100 px-1">DATABASE_URL</code>{" "}
              {problem.env.ada ? "sudah ada" : "belum ada di server"}
            </span>
          </li>
          <li className="flex items-start gap-1.5">
            {problem.env.local ? <Monitor size={15} className="mt-0.5 shrink-0" /> : <Cloud size={15} className="mt-0.5 shrink-0" />}
            <span>
              Server database:{" "}
              <code className="rounded bg-slate-100 px-1">{problem.env.host ?? "tidak diketahui"}</code>
            </span>
          </li>
          <li className="flex items-start gap-1.5">
            {problem.env.pakaiPooler ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />}
            <span>
              Memakai koneksi{" "}
              <strong>{problem.env.pakaiPooler ? "Pooled (benar untuk Vercel)" : "Direct / tidak terdeteksi"}</strong>
            </span>
          </li>
          <li className="flex items-start gap-1.5">
            {problem.env.pakaiSsl ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />}
            <span>
              Koneksi terenkripsi (sslmode){" "}
              {problem.env.pakaiSsl ? "sudah diaktifkan" : "belum terlihat di URL (akan diaktifkan otomatis oleh aplikasi)"}
            </span>
          </li>
        </ul>
        {fatal ? (
          <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            <Lightbulb size={14} className="mt-0.5 shrink-0" />
            <span>
              Panduan lengkap dengan gambar langkah: buka halaman{" "}
              <Link href="/panduan" className="font-bold underline">
                /panduan
              </Link>{" "}
              → bagian LANGKAH B (Neon) dan LANGKAH D2 (Vercel).
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
