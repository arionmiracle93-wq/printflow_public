"use client";

import { useEffect } from "react";

/** Registrasi service worker sekali untuk PWA, offline fallback, dan Web Push. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.error("Service worker registration failed", error);
    });
  }, []);
  return null;
}
