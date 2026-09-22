"use client";

import { RefreshCw, ServerCrash, Stethoscope } from "lucide-react";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 620,
            width: "100%",
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 20px rgba(15,23,42,.06)",
            overflow: "hidden",
          }}
        >
          <div style={{ background: "linear-gradient(90deg,#4f46e5,#7c3aed)", color: "#fff", padding: "18px 22px" }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
              <ServerCrash size={20} strokeWidth={2.3} /> Aplikasi tidak dapat dimuat
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#e0e7ff" }}>
              Biasanya karena <strong>DATABASE_URL</strong> belum diisi di Vercel.
            </p>
          </div>
          <div style={{ padding: 22, fontSize: 14, lineHeight: 1.7, color: "#334155" }}>
            <ol style={{ margin: "0 0 16px", paddingLeft: 20 }}>
              <li>Buka dashboard Vercel → project Anda.</li>
              <li>
                Menu <strong>Settings → Environment Variables</strong>.
              </li>
              <li>
                Tambahkan <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 6 }}>DATABASE_URL</code>{" "}
                dengan connection string <strong>Pooled</strong> dari Neon.
              </li>
              <li>
                Buka menu <strong>Deployments → ⋯ → Redeploy</strong>.
              </li>
            </ol>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  cursor: "pointer",
                  border: 0,
                  borderRadius: 12,
                  padding: "10px 18px",
                  fontWeight: 700,
                  fontSize: 14,
                  background: "#4f46e5",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <RefreshCw size={15} /> Coba Lagi
              </button>
              <a
                href="/status"
                style={{
                  textDecoration: "none",
                  borderRadius: 12,
                  padding: "10px 18px",
                  fontWeight: 700,
                  fontSize: 14,
                  border: "1px solid #e2e8f0",
                  color: "#334155",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Stethoscope size={15} /> Halaman Diagnosis
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
