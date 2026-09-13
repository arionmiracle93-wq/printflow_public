"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "print-flow-theme";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

/**
 * Tombol pindah tema terang/gelap. Pilihan disimpan di localStorage supaya
 * konsisten setiap kali aplikasi dibuka lagi. Skrip anti-flash di layout
 * yang menentukan tema awal saat load — komponen ini cuma menyinkronkan
 * state tombolnya lalu menangani klik.
 */
export function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !(isDark ?? false);
    setIsDark(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Mode privat / storage penuh — tema tetap berlaku untuk sesi ini saja.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Pindah ke tema terang" : "Pindah ke tema gelap"}
      title={isDark ? "Tema terang" : "Tema gelap"}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition-all hover:bg-white/20 md:h-9 md:w-9"
    >
      {isDark === null ? (
        <span className="block h-[18px] w-[18px]" />
      ) : isDark ? (
        <Sun size={18} strokeWidth={2.3} />
      ) : (
        <Moon size={18} strokeWidth={2.3} />
      )}
    </button>
  );
}
