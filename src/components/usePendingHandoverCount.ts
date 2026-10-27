"use client";

import { useEffect, useState } from "react";

/**
 * JUMLAH SERAH TERIMA MENUNGGU (dipakai badge Shift di navigasi)
 * ===================================================================
 * Dipakai MainNav untuk badge Shift di bar atas dan bottom navigation
 * mobile. Angka ini penting supaya owner/karyawan tahu ada serah terima
 * yang menunggu tanpa harus membuka halaman Shift lebih dulu.
 *
 * Cara kerjanya: modul menyimpan satu angka dan satu daftar pemanggil.
 * Pemanggil pertama yang memasang satu timer; pemanggil berikutnya
 * langsung memakai angka yang sudah ada. Timer berhenti sendiri saat
 * tidak ada lagi yang memakainya - jadi tidak ada permintaan yang berjalan
 * tanpa gunanya di halaman yang tidak memakainya.
 *
 * Poll 30 detik, ditambah saat jendela kembali aktif. Daftar angka ini
 * kecil (jumlah belasan) dan sudah dikirim sebagai no-store.
 */
const POLL_MS = 30_000;

let value = 0;
const pemanggil = new Set<(n: number) => void>();
let timer: number | null = null;

async function refresh() {
  try {
    const res = await fetch("/api/handovers/pending-count", { cache: "no-store" });
    const json = (await res.json()) as { ok?: boolean; count?: number };
    if (!json.ok) return;
    const next = Math.max(0, Number(json.count) || 0);
    if (next === value) return;
    value = next;
    for (const p of pemanggil) p(value);
  } catch {
    // Navigasi tidak boleh rusak hanya karena badge gagal dimuat.
  }
}

let stopHandlers: (() => void) | null = null;

function start() {
  if (timer !== null) return;
  void refresh();
  timer = window.setInterval(() => void refresh(), POLL_MS);
  const onFocus = () => void refresh();
  const onVisibility = () => {
    if (document.visibilityState === "visible") void refresh();
  };
  window.addEventListener("focus", onFocus);
  window.addEventListener("handover-count-changed", onFocus);
  document.addEventListener("visibilitychange", onVisibility);
  stopHandlers = () => {
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("handover-count-changed", onFocus);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

function stop() {
  if (timer === null) return;
  window.clearInterval(timer);
  timer = null;
  stopHandlers?.();
  stopHandlers = null;
}

export function usePendingHandoverCount(): number {
  /* useState(value) sudah memberi angka terbaru pada render pertama,
     jadi tidak perlu setState lagi di dalam efek. Perubahan setelah
     itu dikirim lewat daftar pemanggil. */
  const [count, setCount] = useState(value);

  useEffect(() => {
    pemanggil.add(setCount);
    start();
    return () => {
      pemanggil.delete(setCount);
      if (pemanggil.size === 0) stop();
    };
  }, []);

  return count;
}