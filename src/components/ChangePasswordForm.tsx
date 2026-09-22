"use client";

import { CheckCircle2, Save } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("Password baru minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password baru tidak sama.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setError(json.error ?? "Gagal mengganti password.");
        return;
      }
      setDone(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card max-w-md space-y-3 p-4">
      <div>
        <label className="label">Password saat ini</label>
        <input
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="input"
          autoComplete="current-password"
        />
      </div>
      <div>
        <label className="label">Password baru</label>
        <input
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="input"
          autoComplete="new-password"
        />
        <p className="mt-1 text-[11px] text-slate-500">Minimal 8 karakter.</p>
      </div>
      <div>
        <label className="label">Ulangi password baru</label>
        <input
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="input"
          autoComplete="new-password"
        />
      </div>
      {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
      {done ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
          <CheckCircle2 size={14} /> Password berhasil diganti. Perangkat lain otomatis logout.
        </p>
      ) : null}
      <button type="submit" disabled={busy} className="btn-primary inline-flex w-full items-center justify-center gap-1.5">
        {busy ? (
          "Menyimpan…"
        ) : (
          <>
            <Save size={15} /> Ganti Password
          </>
        )}
      </button>
    </form>
  );
}
