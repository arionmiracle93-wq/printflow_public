"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

function getSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

/**
 * True hanya setelah komponen hidup di client.
 *
 * Dipakai untuk menunda portal/elemen yang butuh document sampai proses
 * hydration selesai. Nilai server tetap false, lalu React memperbarui ke
 * true setelah hydration - tanpa setState di dalam effect.
 */
export function useMounted() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
