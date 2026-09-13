"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, UserCog } from "lucide-react";
import { roleLabel, type UserRole } from "@/lib/auth-client";

export function UserMenu({ name, role }: { name: string; role: UserRole }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`Akun ${name}`}
        className={`flex h-10 max-w-[calc(100vw-4.5rem)] items-center gap-2 rounded-xl border px-2.5 text-white transition md:h-9 md:max-w-none ${
          open ? "border-teal-300/50 bg-white/20" : "border-white/15 bg-white/10 hover:bg-white/15"
        }`}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-[10px] font-black text-[#07384f]">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="block whitespace-nowrap text-left md:hidden xl:block">
          <span className="block text-[11px] font-bold leading-none">{name}</span>
          <span className="mt-0.5 block text-[9px] text-cyan-100/60">{roleLabel(role)}</span>
        </span>
        <ChevronDown
          size={13}
          className={`shrink-0 text-cyan-100/60 transition-transform md:hidden xl:block ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Tutup menu akun"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-12 z-50 w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_20px_55px_rgba(7,56,79,.2)] md:left-auto md:right-0 md:top-11">
            <div className="border-b border-slate-100 px-2.5 py-2">
              <p className="break-words text-xs font-extrabold text-[#07384f]">{name}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">{roleLabel(role)}</p>
            </div>
            {role === "owner" ? (
              <Link
                href="/pengguna"
                prefetch
                onClick={() => setOpen(false)}
                className="mt-1 flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700"
              >
                <UserCog size={14} /> Kelola Pengguna
              </Link>
            ) : null}
            <button
              type="button"
              onClick={logout}
              disabled={busy}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
            >
              <LogOut size={14} /> {busy ? "Keluar…" : "Keluar"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
