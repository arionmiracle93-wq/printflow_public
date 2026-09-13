"use client";

import Link from "next/link";
import { Factory, MoreHorizontal } from "lucide-react";
import type { UserRole } from "@/lib/auth-client";

/**
 * KOMPATIBILITAS DEPLOYMENT LAMA
 *
 * Navigasi mobile utama sekarang menggunakan MainNav + MoreMenu di header.
 * File ini dipertahankan sementara agar repository yang diperbarui lewat
 * upload manual (yang tidak otomatis menghapus file lama) tetap lolos build.
 *
 * Tidak ada lagi role "operator" atau "kasir"; hanya Owner dan Karyawan.
 */
export function MobileMoreMenu({ role }: { role: UserRole }) {
  if (role !== "owner" && role !== "karyawan") return null;

  return (
    <Link
      href="/mitra"
      prefetch
      className="flex w-full flex-col items-center gap-1 px-1 py-2 text-[10px] font-bold text-slate-400 md:hidden"
      aria-label="Buka Produksi Mitra"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-xl">
        {role === "karyawan" ? <Factory size={19} /> : <MoreHorizontal size={20} />}
      </span>
      {role === "karyawan" ? "Mitra" : "Lainnya"}
    </Link>
  );
}
