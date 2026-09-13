"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Feedback navigasi yang tidak mengganggu transisi cepat.
 * Progress baru tampil setelah 180ms; jika prefetch membuat perpindahan instan,
 * timer dibatalkan sebelum indikator sempat terlihat.
 */
export function NavigationFeedback() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const showRef = useRef<number | null>(null);
  const safetyRef = useRef<number | null>(null);

  function clearTimers() {
    if (showRef.current) window.clearTimeout(showRef.current);
    if (safetyRef.current) window.clearTimeout(safetyRef.current);
    showRef.current = null;
    safetyRef.current = null;
  }

  useEffect(() => {
    clearTimers();
    setLoading(false);
  }, [pathname]);

  useEffect(() => {
    const start = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        url.href === window.location.href ||
        url.hash ||
        url.pathname === window.location.pathname
      ) return;

      clearTimers();
      // Jangan flash progress untuk navigasi cepat dari prefetch/router cache.
      showRef.current = window.setTimeout(() => setLoading(true), 180);
      safetyRef.current = window.setTimeout(() => {
        clearTimers();
        setLoading(false);
      }, 8_000);
    };
    document.addEventListener("click", start, true);
    return () => {
      document.removeEventListener("click", start, true);
      clearTimers();
    };
  }, []);

  if (!loading) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-1 overflow-hidden bg-teal-950/20" role="progressbar" aria-label="Memuat halaman">
      <div className="navigation-progress h-full w-1/3 rounded-r-full bg-gradient-to-r from-amber-300 via-amber-400 to-teal-300 shadow-[0_0_12px_rgba(251,191,36,.8)]" />
    </div>
  );
}
