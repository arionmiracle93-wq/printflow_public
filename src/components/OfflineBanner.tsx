"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Pita kecil saat perangkat offline: data di layar adalah salinan terakhir, pembayaran akan dikirim otomatis. */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[80] flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-center text-xs font-bold text-amber-950 shadow">
      <WifiOff size={14} className="shrink-0" />
      <span>Sedang offline. Data yang tampil bisa sudah lama; pembayaran yang dicatat akan dikirim otomatis saat online.</span>
    </div>
  );
}
