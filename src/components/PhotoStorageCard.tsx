"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, CloudUpload, HardDrive, Loader2, PlugZap } from "lucide-react";
import { formatBytes } from "@/lib/photos";

type Usage = { files: number; bytes: number; dbFiles: number; dbBytes: number; blobFiles: number; blobBytes: number };
type Note = { tone: "ok" | "warn" | "error"; text: string } | null;

/**
 * KARTU "PENYIMPANAN FOTO" di Pengaturan (khusus Owner).
 *
 * Tiga keadaan:
 *   1. Blob belum dipasang : langkah setup di dashboard Vercel.
 *   2. Blob terpasang, masih ada foto lama di database : tombol pindahkan.
 *   3. Semua foto sudah di Blob : ringkasan saja.
 *
 * Pemindahan berjalan per batch kecil dan bisa dihentikan kapan saja.
 * Foto yang sedang dipindah tetap bisa dibuka seperti biasa.
 */
export function PhotoStorageCard({ blob, initialUsage }: { blob: boolean; initialUsage: Usage }) {
  const router = useRouter();
  const [usage, setUsage] = useState(initialUsage);
  const [busy, setBusy] = useState<"test" | "migrate" | "reclaim" | null>(null);
  const [stop, setStop] = useState(false);
  // Dibaca di dalam perulangan pemindahan, jadi harus ref (bukan state).
  const stopRef = useRef(false);
  const [note, setNote] = useState<Note>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function call(action: string) {
    const res = await fetch("/api/admin/photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    return (await res.json()) as {
      ok: boolean;
      error?: string;
      moved?: number;
      failed?: number;
      remaining?: number;
      errors?: string[];
    };
  }

  async function refresh() {
    const res = await fetch("/api/admin/photos");
    const json = (await res.json()) as { ok: boolean; usage?: Usage };
    if (json.ok && json.usage) setUsage(json.usage);
  }

  async function test() {
    setBusy("test");
    setNote(null);
    try {
      const json = await call("test");
      setNote(json.ok ? { tone: "ok", text: "Koneksi ke Vercel Blob berhasil. Foto baru otomatis tersimpan di sana." } : { tone: "error", text: json.error ?? "Uji koneksi gagal." });
    } catch {
      setNote({ tone: "error", text: "Tidak dapat menghubungi server." });
    } finally {
      setBusy(null);
    }
  }

  async function migrate() {
    const total = usage.dbFiles;
    if (!total) return;
    setBusy("migrate");
    setStop(false);
    stopRef.current = false;
    setNote(null);
    setProgress({ done: 0, total });
    let done = 0;
    let failedTotal = 0;
    let lastError: string | undefined;
    let stopped = false;
    try {
      // Satu permintaan = satu batch kecil. Berhenti kalau selesai,
      // kalau batch tidak memindahkan apa pun (supaya tidak berputar
      // terus saat ada foto yang selalu gagal), atau kalau dihentikan.
      for (let round = 0; round < 500; round += 1) {
        if (stopRef.current) {
          stopped = true;
          break;
        }
        const json = await call("migrate");
        if (!json.ok) {
          lastError = json.error;
          break;
        }
        done += json.moved ?? 0;
        failedTotal += json.failed ?? 0;
        if (json.errors?.length) lastError = json.errors[0];
        setProgress({ done, total });
        if (!json.remaining || !json.moved) break;
      }
      await refresh();
      if (stopped) setNote({ tone: "warn", text: `Dihentikan. ${done} foto sudah dipindah, sisanya bisa dilanjutkan kapan saja.` });
      else if (lastError && failedTotal) setNote({ tone: "warn", text: `${done} foto dipindah, ${failedTotal} gagal dan tetap aman di database. Contoh penyebab: ${lastError}` });
      else if (lastError) setNote({ tone: "error", text: lastError });
      else setNote({ tone: "ok", text: `${done} foto berhasil dipindah ke Vercel Blob.` });
      router.refresh();
    } catch {
      setNote({ tone: "error", text: `Koneksi terputus setelah ${done} foto. Tidak ada foto yang hilang; tekan tombol lagi untuk melanjutkan.` });
      await refresh().catch(() => undefined);
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function reclaim() {
    setBusy("reclaim");
    setNote(null);
    try {
      const json = await call("reclaim");
      setNote(json.ok ? { tone: "ok", text: "Ruang database bekas foto sudah dikembalikan." } : { tone: "error", text: json.error ?? "Gagal mengembalikan ruang database." });
    } finally {
      setBusy(null);
    }
  }

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="card min-w-0 overflow-hidden p-4">
      <div className="flex items-center gap-3">
        <span className="icon-tile">
          <HardDrive size={18} />
        </span>
        <div className="min-w-0">
          <h3 className="section-title">Penyimpanan foto</h3>
          <p className="text-[11px] text-[color:var(--pf-ink-3)]">
            {blob ? "Foto baru disimpan di Vercel Blob (private)" : "Foto masih disimpan di database"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-[color:var(--pf-surface-2)] px-3 py-2.5">
          <p className="text-[11px] text-[color:var(--pf-ink-3)]">Di database</p>
          <p className="pf-num mt-0.5 text-sm font-semibold text-[color:var(--pf-ink)]">
            {usage.dbFiles} foto <span className="font-normal text-[color:var(--pf-ink-3)]">{formatBytes(usage.dbBytes)}</span>
          </p>
        </div>
        <div className="rounded-xl bg-[color:var(--pf-surface-2)] px-3 py-2.5">
          <p className="text-[11px] text-[color:var(--pf-ink-3)]">Di Vercel Blob</p>
          <p className="pf-num mt-0.5 text-sm font-semibold text-[color:var(--pf-ink)]">
            {usage.blobFiles} foto <span className="font-normal text-[color:var(--pf-ink-3)]">{formatBytes(usage.blobBytes)}</span>
          </p>
        </div>
      </div>

      {!blob ? (
        <div className="mt-4 rounded-xl border border-[color:var(--pf-line)] bg-[color:var(--pf-surface-2)] p-3">
          <p className="text-[13px] font-semibold text-[color:var(--pf-ink)]">Cara memasang Vercel Blob (sekali saja)</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-[color:var(--pf-ink-2)]">
            <li>Buka project Print Flow di vercel.com, pilih tab <b>Storage</b>.</li>
            <li>
              Klik <b>Create</b>, pilih <b>Blob</b>, lalu pada pilihan akses pilih <b>Private</b>.
            </li>
            <li>Hubungkan (Connect) store itu ke project Print Flow.</li>
            <li>
              Buka tab <b>Deployments</b>, lalu <b>Redeploy</b> deployment terakhir.
            </li>
            <li>Kembali ke halaman ini, tekan &quot;Uji koneksi&quot;, lalu &quot;Pindahkan foto lama&quot;.</li>
          </ol>
          <p className="mt-2 text-[11px] text-[color:var(--pf-ink-3)]">
            Tidak ada kunci yang perlu disalin. Sebelum langkah ini, foto tetap tersimpan di database seperti biasa.
          </p>
        </div>
      ) : null}

      {progress ? (
        <div className="mt-4" aria-live="polite">
          <div className="flex items-center justify-between text-xs text-[color:var(--pf-ink-2)]">
            <span>Memindahkan foto…</span>
            <span className="pf-num">
              {progress.done} / {progress.total}
            </span>
          </div>
          <div className="progress-track mt-1.5">
            <div className="h-full rounded-full bg-[color:var(--pf-accent)] transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      {note ? (
        <p
          role="status"
          className={`mt-3 flex items-start gap-1.5 rounded-xl px-3 py-2 text-xs font-medium ${
            note.tone === "ok"
              ? "bg-[color:var(--pf-ok-soft)] text-[color:var(--pf-ok)]"
              : note.tone === "warn"
                ? "bg-[color:var(--pf-warn-soft)] text-[color:var(--pf-warn)]"
                : "bg-[color:var(--pf-danger-soft)] text-[color:var(--pf-danger)]"
          }`}
        >
          {note.tone === "ok" ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
          <span className="min-w-0 break-words">{note.text}</span>
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
        <button type="button" onClick={test} disabled={busy !== null} className="btn-ghost w-full sm:w-auto">
          {busy === "test" ? <Loader2 size={15} className="animate-spin" /> : <PlugZap size={15} />} Uji koneksi
        </button>
        {blob && usage.dbFiles > 0 ? (
          busy === "migrate" ? (
            <button
              type="button"
              onClick={() => {
                stopRef.current = true;
                setStop(true);
              }}
              disabled={stop}
              className="btn-danger w-full sm:w-auto"
            >
              {stop ? "Menghentikan…" : "Hentikan"}
            </button>
          ) : (
            <button type="button" onClick={migrate} disabled={busy !== null} className="btn-secondary w-full sm:w-auto">
              <CloudUpload size={15} /> Pindahkan {usage.dbFiles} foto lama
            </button>
          )
        ) : null}
        {blob && usage.dbFiles === 0 && usage.blobFiles > 0 ? (
          <button type="button" onClick={reclaim} disabled={busy !== null} className="btn-ghost w-full sm:w-auto">
            {busy === "reclaim" ? <Loader2 size={15} className="animate-spin" /> : <HardDrive size={15} />} Kembalikan ruang database
          </button>
        ) : null}
      </div>
    </div>
  );
}
