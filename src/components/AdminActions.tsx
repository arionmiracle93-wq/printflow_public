"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Download,
  Eraser,
  FlaskConical,
  History,
  Info,
  Link2,
  Package,
  Users,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

export function AdminActions({ hasDemoData }: { hasDemoData: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: ReactNode } | null>(null);
  const [confirmAll, setConfirmAll] = useState("");
  const [showDanger, setShowDanger] = useState(false);
  const [copied, setCopied] = useState(false);

  async function run(kind: "demo" | "semua") {
    if (kind === "semua" && confirmAll.trim() !== "HAPUS SEMUA") {
      setMessage({ ok: false, text: 'Ketik persis "HAPUS SEMUA" di kotak konfirmasi dulu.' });
      return;
    }
    const label = kind === "demo" ? "Menghapus data contoh…" : "Mengosongkan semua data…";
    setBusy(label);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: kind, konfirmasi: confirmAll.trim() }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        deletedOrders?: number | string;
        deletedCustomers?: number | string;
      };
      if (!json.ok) {
        setMessage({ ok: false, text: json.error ?? "Gagal menghapus data." });
        return;
      }
      setMessage({
        ok: true,
        text:
          kind === "demo" ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={14} className="shrink-0" /> Data contoh terhapus: {json.deletedOrders} pekerjaan & {json.deletedCustomers} pelanggan contoh.
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={14} className="shrink-0" /> Semua data sudah dikosongkan. Aplikasi siap diisi dari nol.
            </span>
          ),
      });
      setConfirmAll("");
      setShowDanger(false);
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Tidak dapat menghubungi server." });
    } finally {
      setBusy(null);
    }
  }

  async function seed() {
    setBusy("Mengisi data contoh…");
    setMessage(null);
    try {
      const res = await fetch("/api/setup?seed=1");
      const json = (await res.json()) as { ok: boolean; seeded?: boolean };
      setMessage({
        ok: true,
        text: json.ok ? (
          json.seeded ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={14} className="shrink-0" /> Data contoh berhasil diisi. Coba jelajahi dashboard untuk belajar.
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Info size={14} className="shrink-0" /> Data contoh tidak diisi karena tabel Anda sudah berisi data.
            </span>
          )
        ) : (
          "Gagal mengisi data contoh."
        ),
      });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Tidak dapat menghubungi server." });
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setMessage({ ok: false, text: "Browser menolak akses clipboard. Salin alamat di address bar secara manual." });
    }
  }

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-hidden">
      <div className="card min-w-0 max-w-full overflow-hidden p-4">
        <h3 className="flex items-center gap-1.5 break-words text-sm font-bold text-slate-900">
          <Eraser size={16} /> Data contoh &amp; reset
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {hasDemoData
            ? "Terdeteksi data contoh (latihan). Hapus supaya laporan & peringatan AI memakai pekerjaan Anda yang sebenarnya."
            : "Tidak ada data contoh. Aplikasi Anda berisi pekerjaan nyata."}
        </p>
        <div className="mt-3 grid min-w-0 gap-2 sm:flex sm:flex-wrap">
          {hasDemoData ? (
            <button type="button" onClick={() => run("demo")} disabled={busy !== null} className="btn-primary inline-flex w-full items-center justify-center gap-1.5 sm:w-auto">
              {busy === "Menghapus data contoh…" ? (
                "Menghapus…"
              ) : (
                <>
                  <Eraser size={14} /> Hapus Data Contoh
                </>
              )}
            </button>
          ) : (
            <button type="button" onClick={seed} disabled={busy !== null} className="btn-ghost inline-flex w-full items-center justify-center gap-1.5 sm:w-auto">
              {busy === "Mengisi data contoh…" ? (
                "Mengisi…"
              ) : (
                <>
                  <FlaskConical size={14} /> Isi Data Contoh (untuk belajar)
                </>
              )}
            </button>
          )}
          <button type="button" onClick={copyLink} className="btn-ghost inline-flex w-full items-center justify-center gap-1.5 sm:w-auto">
            {copied ? (
              <>
                <CheckCircle2 size={14} /> Alamat tersalin!
              </>
            ) : (
              <>
                <Link2 size={14} /> Salin Alamat Aplikasi
              </>
            )}
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/60 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Zona berbahaya</p>
          <p className="mt-1 text-xs text-rose-700">
            Mengosongkan seluruh data menghapus pekerjaan, pelanggan, dan riwayat. Tidak bisa dibatalkan.
          </p>
          {showDanger ? (
            <div className="mt-2 space-y-2">
              <input
                value={confirmAll}
                onChange={(e) => setConfirmAll(e.target.value)}
                placeholder='Ketik: HAPUS SEMUA'
                className="input"
              />
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                <button type="button" onClick={() => run("semua")} disabled={busy !== null} className="btn-danger inline-flex w-full items-center justify-center gap-1.5 sm:w-auto">
                  {busy === "Mengosongkan semua data…" ? (
                    "Menghapus…"
                  ) : (
                    <>
                      <AlertTriangle size={14} /> Ya, Kosongkan Semua Data
                    </>
                  )}
                </button>
                <button type="button" onClick={() => setShowDanger(false)} className="btn-ghost w-full sm:w-auto">
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowDanger(true)} className="btn-danger mt-2">
              Kosongkan semua data…
            </button>
          )}
        </div>

        {message ? (
          <p
            className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${
              message.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            }`}
          >
            {message.text}
          </p>
        ) : null}
      </div>

      <div className="card min-w-0 max-w-full overflow-hidden p-4">
        <h3 className="flex items-center gap-1.5 break-words text-sm font-bold text-slate-900">
          <Download size={16} /> Unduh cadangan (CSV / Excel)
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          File terbuka rapi di Excel/Google Sheets. Saran: unduh sebulan sekali dan simpan di Google Drive.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a href="/api/export?type=orders" className="btn-ghost inline-flex items-center gap-1.5">
            <ClipboardList size={14} /> Pekerjaan (CSV)
          </a>
          <a href="/api/export?type=pelanggan" className="btn-ghost inline-flex items-center gap-1.5">
            <Users size={14} /> Pelanggan (CSV)
          </a>
          <a href="/api/export?type=keuangan" className="btn-ghost inline-flex items-center gap-1.5">
            <Wallet size={14} /> Keuangan &amp; Piutang (CSV)
          </a>
          <a href="/api/export?type=riwayat" className="btn-ghost inline-flex items-center gap-1.5">
            <History size={14} /> Riwayat Produksi (CSV)
          </a>
          <a href="/api/export?type=item" className="btn-ghost inline-flex items-center gap-1.5 sm:col-span-2">
            <Package size={14} /> Rincian Item per Produk (CSV)
          </a>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          File &ldquo;Pekerjaan&rdquo; berisi satu baris per pekerjaan (isi produknya digabung dalam satu kolom),
          sedangkan &ldquo;Rincian Item&rdquo; memecah tiap produk jadi barisnya sendiri — cocok untuk menghitung
          total per jenis produk.
        </p>
      </div>
    </div>
  );
}
