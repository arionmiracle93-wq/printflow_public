"use client";

import { useSyncExternalStore } from "react";

function greetingFor(hour: number) {
  if (hour < 10) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

/**
 * Sapaan berdasarkan jam perangkat pengguna (pola sama seperti LocalDateTime:
 * render netral dulu di server, baru disesuaikan di client agar tidak hydration-mismatch).
 */
function subscribe() {
  return () => {};
}

function getSnapshot() {
  return greetingFor(new Date().getHours());
}

function getServerSnapshot() {
  return "Halo";
}

export function Greeting() {
  const text = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return <span suppressHydrationWarning>{text}</span>;
}
