"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "print-flow-theme";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function subscribe(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return null;
}

function useDarkMode() {
  // class "dark" di <html> adalah sumber kebenaran. MutationObserver membuat
  // tombol ikut berubah tanpa setState di dalam effect.
  const isDark = useSyncExternalStore<boolean | null>(subscribe, getSnapshot, getServerSnapshot);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Mode privat / storage penuh - tema tetap berlaku untuk sesi ini saja.
    }
  };

  return { isDark, toggle };
}

/**
 * Tombol pindah tema terang/gelap. Pilihan disimpan di localStorage supaya
 * konsisten setiap kali aplikasi dibuka lagi. Skrip anti-flash di layout
 * yang menentukan tema awal saat load - komponen ini cuma menyinkronkan
 * state tombolnya lalu menangani klik.
 */
export function ThemeToggle() {
  const { isDark, toggle } = useDarkMode();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Pindah ke tema terang" : "Pindah ke tema gelap"}
      title={isDark ? "Tema terang" : "Tema gelap"}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--pf-line)] bg-[color:var(--pf-surface-2)] text-[color:var(--pf-ink)] transition-all hover:border-[color:var(--pf-accent-line)] hover:bg-[color:var(--pf-accent-soft)] md:h-9 md:w-9"
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

/**
 * Tombol tema berbentuk panel lebar untuk sidebar modul invoice. Bentuknya
 * mengikuti tombol biasa (bukan tombol ikon bundar header) supaya nyambung
 * dengan daftar menu di atasnya.
 */
export function SidebarThemeButton({ className = "" }: { className?: string }) {
  const { isDark, toggle } = useDarkMode();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Pindah ke tema terang" : "Pindah ke tema gelap"}
      className={`ppi-side-theme ${className}`}
    >
      <span>{isDark === null ? "Tema" : isDark ? "Mode Gelap" : "Mode Terang"}</span>
      <span className="ppi-side-theme-icon" aria-hidden>
        {isDark ? <Moon size={14} strokeWidth={2.3} /> : <Sun size={14} strokeWidth={2.3} />}
      </span>
    </button>
  );
}
