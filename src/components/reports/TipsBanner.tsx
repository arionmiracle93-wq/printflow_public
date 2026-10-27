"use client";

import { useState, useSyncExternalStore } from "react";
import { Lightbulb, X } from "lucide-react";

/**
 * Banner tips di bawah laporan. Bisa ditutup; seleksi tertutup disimpan
 * 30 hari di localStorage supaya tidak muncul lagi begitu pindah periode.
 *
 * Pintunya useSyncExternalStore: nilai bawaan server = false (tampil),
 * nilai pembaca di klien membaca localStorage. Tidak ada setState di
 * dalam effect, jadi juga bebas dari warning cascading render.
 */

const KEY = "pf-laporan-tips-off";
const HOLD_MS = 30 * 86_400_000;

function subscribe(fn: () => void): () => void {
  window.addEventListener("storage", fn);
  return () => window.removeEventListener("storage", fn);
}

function wasDismissed(): boolean {
  try {
    const off = Number(localStorage.getItem(KEY) ?? 0);
    return Boolean(off) && Date.now() - off < HOLD_MS;
  } catch {
    /* localStorage bisa gagal (mode privat) - anggap belum pernah ditutup */
    return false;
  }
}

export function TipsBanner({ title, body }: { title: string; body: string }) {
  const dismissed = useSyncExternalStore(subscribe, wasDismissed, () => false);
  const [manualHidden, setManualHidden] = useState(false);

  if (dismissed || manualHidden) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 dark:border-teal-900/60 dark:bg-teal-950/40">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300">
        <Lightbulb size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-teal-900 dark:text-teal-200">{title}</p>
        <p className="mt-0.5 text-xs text-teal-800/80 dark:text-teal-300/70">{body}</p>
      </div>
      <button
        type="button"
        aria-label="Tutup tips"
        onClick={() => {
          try {
            localStorage.setItem(KEY, String(Date.now()));
          } catch {
            /* abaikan: tutup hanya untuk sesi ini */
          }
          setManualHidden(true);
        }}
        className="rounded-lg p-1 text-teal-700/70 hover:bg-teal-100 hover:text-teal-900 dark:text-teal-300/70 dark:hover:bg-teal-900/60"
      >
        <X size={15} />
      </button>
    </div>
  );
}
