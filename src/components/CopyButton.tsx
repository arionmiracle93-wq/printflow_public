"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Tombol salin kecil (nomor rekening dsb.). Hanya tampil di layar, tidak ikut tercetak. */
export function CopyButton({ text, label = "Salin" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          window.prompt("Salin manual:", text);
        }
      }}
      className="ppi-screen-only ppi-icon-btn"
      style={{ width: 22, height: 22 }}
    >
      {done ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}
