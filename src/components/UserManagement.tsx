"use client";

import { useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, Shield, UserCheck, UserX } from "lucide-react";
import { roleLabel } from "@/lib/auth-client";

type User = {
  id: number;
  name: string;
  username: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ name: "", username: "", password: "", role: "karyawan" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const res = await fetch("/api/users");
    const json = (await res.json()) as { ok?: boolean; data?: User[] };
    if (json.ok && json.data) setUsers(json.data);
  }
  useEffect(() => { void load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!json.ok) setError(json.error ?? "Gagal membuat pengguna.");
    else {
      setForm({ name: "", username: "", password: "", role: "karyawan" });
      setShowForm(false); await load();
    }
    setBusy(false);
  }

  type PatchResult = {
    ok?: boolean;
    error?: string;
    currentSessionRevoked?: boolean;
    selfUpdated?: boolean;
    reloginRequired?: boolean;
    targetName?: string;
    changed?: { password?: boolean; username?: boolean; role?: boolean; active?: boolean };
  };

  async function patch(id: number, data: Record<string, unknown>) {
    setBusy(true); setError(null); setNotice(null);
    const res = await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = (await res.json()) as PatchResult;
    if (!json.ok) {
      setError(json.error ?? "Gagal mengubah pengguna.");
      setBusy(false);
      return;
    }

    // Susun pesan sesuai apa yang BENAR-BENAR diubah. Versi lama selalu
    // menyebut "username" walaupun yang ditekan adalah Reset Password,
    // sehingga owner bingung kenapa tiba-tiba diminta login ulang.
    const c = json.changed ?? {};
    const nama = json.targetName ?? "Pengguna";
    const apa = c.password ? "Password" : c.username ? "Username" : c.role ? "Role" : c.active ? "Status akun" : "Data";

    if (json.selfUpdated) {
      setNotice(`${apa} akun Anda sendiri berhasil diubah. Anda tetap login di perangkat ini, tetapi perangkat lain yang memakai akun Anda otomatis keluar dan harus login ulang.`);
    } else if (json.reloginRequired) {
      setNotice(`${apa} ${nama} berhasil diubah. Semua perangkat ${nama} otomatis keluar dan harus login ulang${c.password ? " memakai password baru" : ""}.`);
    } else {
      setNotice(`${apa} ${nama} berhasil diperbarui.`);
    }

    await load(); setBusy(false);
  }

  async function editUsername(user: User) {
    const username = prompt(`Username baru untuk ${user.name}:`, user.username)?.trim().toLowerCase();
    if (!username || username === user.username) return;
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      setError("Username harus 3–30 karakter: huruf kecil, angka, titik, underscore, atau minus.");
      return;
    }
    if (!confirm(`Ubah username @${user.username} menjadi @${username}? User harus login ulang.`)) return;
    await patch(user.id, { username });
  }

  async function reset(user: User) {
    const password = prompt(`Password baru untuk ${user.name} (minimal 8 karakter):`);
    if (!password) return;
    if (password.length < 8) { setError("Password minimal 8 karakter."); return; }
    // Beri tahu dampaknya SEBELUM dieksekusi. Reset password mencabut seluruh
    // sesi pengguna tersebut — kalau dia sedang mengerjakan order, dia akan
    // langsung terlempar ke halaman login.
    const peringatan = user.id
      ? `Reset password ${user.name}?\n\nSemua perangkat yang sedang login sebagai @${user.username} akan langsung keluar dan harus login ulang memakai password baru. Pastikan password barunya sudah Anda catat dan sampaikan ke yang bersangkutan.`
      : "";
    if (!confirm(peringatan)) return;
    await patch(user.id, { password });
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-clip">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-black text-[#07384f] sm:text-2xl">Pengguna &amp; Hak Akses</h1>
          <p className="text-sm text-slate-500">Kelola akun Owner dan Karyawan.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary w-full sm:w-auto"><Plus size={15} /> Tambah Pengguna</button>
      </div>

      {showForm ? (
        <form onSubmit={create} className="card grid min-w-0 gap-3 p-4 sm:grid-cols-2">
          <label className="min-w-0"><span className="label">Nama Lengkap</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input min-w-0" /></label>
          <label className="min-w-0"><span className="label">Username</span><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })} className="input min-w-0" /></label>
          <label className="min-w-0"><span className="label">Password awal</span><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input min-w-0" /></label>
          <label className="min-w-0"><span className="label">Role</span><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input min-w-0"><option value="karyawan">Karyawan</option><option value="owner">Owner</option></select></label>
          <div className="sm:col-span-2"><button disabled={busy} className="btn-secondary w-full sm:w-auto"><Plus size={14} /> Simpan Pengguna</button></div>
        </form>
      ) : null}

      {error ? <p className="break-words rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
      {notice ? <p className="break-words rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{notice}</p> : null}

      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        {users.map((user) => (
          <div key={user.id} className={`card min-w-0 p-4 ${!user.active ? "opacity-60" : ""}`}>
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0"><p className="break-words text-sm font-extrabold text-[#07384f]">{user.name}</p><p className="break-all text-xs text-slate-500">@{user.username}</p></div>
              <span className={`chip shrink-0 ${user.active ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}><Shield size={11} /> {roleLabel(user.role)}</span>
            </div>
            <p className="mt-3 break-words text-[11px] text-slate-400">Login terakhir: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("id-ID") : "Belum pernah"}</p>
            <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
              <select value={user.role} disabled={busy} onChange={(e) => void patch(user.id, { role: e.target.value })} className="input min-w-0 py-1.5 text-xs sm:max-w-32"><option value="owner">Owner</option><option value="karyawan">Karyawan</option></select>
              <button onClick={() => void editUsername(user)} disabled={busy} className="btn-ghost w-full px-3 py-1.5 text-xs sm:w-auto"><Pencil size={13} /> Ubah Username</button>
              <button onClick={() => void reset(user)} disabled={busy} className="btn-ghost w-full px-3 py-1.5 text-xs sm:w-auto"><KeyRound size={13} /> Reset Password</button>
              <button onClick={() => void patch(user.id, { active: !user.active })} disabled={busy} className={`${user.active ? "btn-danger" : "btn-secondary"} w-full px-3 py-1.5 text-xs sm:w-auto`}>{user.active ? <UserX size={13} /> : <UserCheck size={13} />}{user.active ? " Nonaktifkan" : " Aktifkan"}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
