"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Factory, KeyRound, LogOut, Settings, UserCog } from "lucide-react";
import { roleLabel, type UserRole } from "@/lib/auth-client";

/**
 * Menu akun di header.
 *
 * Revisi UI: dropdown ditutup dengan tombol Escape, position-nya dijepit ke
 * sisi kanan supaya tidak terpotong viewport di HP kecil, dan isi menunya
 * disusun ulang jadi satu kartu rapi (identitas → tautan → keluar).
 */
export function UserMenu({ name, role }: { name: string; role: UserRole }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = name.trim().slice(0, 1).toUpperCase() || "U";
  const isOwner = role === "owner";
  const menuLink =
    "flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-teal-50 hover:text-teal-800 dark:text-slate-300 dark:hover:bg-teal-500/12 dark:hover:text-teal-200";

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Akun ${name}`}
        className={`flex h-10 max-w-[calc(100vw-11rem)] items-center gap-2 rounded-xl border px-1.5 text-left text-white transition md:h-9 md:max-w-none md:px-2 ${
          open
            ? "border-amber-300/70 bg-white/20 shadow-[0_0_0_3px_rgba(251,191,36,.15)]"
            : "border-white/15 bg-white/10 hover:bg-white/[0.18]"
        }`}
      >
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(150deg,#fcd34d,#f59e0b)] text-[11px] font-black text-[#07384f]">
          {initial}
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white bg-emerald-400"
          />
        </span>
        <span className="block min-w-0 whitespace-nowrap leading-tight md:hidden xl:block">
          <span className="block truncate text-[11px] font-bold">{name}</span>
          <span className="mt-0.5 block text-[9px] text-cyan-100/60">{roleLabel(role)}</span>
        </span>
        <ChevronDown
          size={13}
          className={`hidden shrink-0 text-cyan-100/60 transition-transform duration-200 md:block ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="pop-in absolute left-0 top-[calc(100%+.5rem)] z-[85] w-[min(17rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-2 shadow-[var(--shadow-pop)] md:left-auto md:right-0 dark:border-white/10 dark:bg-[#0f202c]"
        >
          <div className="mb-1.5 flex items-center gap-3 rounded-xl bg-[linear-gradient(120deg,#07384f,#0b5566)] px-3 py-2.5 text-white">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-sm font-black text-[#07384f]">
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-extrabold">{name}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-cyan-100/75">
                {roleLabel(role)}
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[9px] font-bold ${
                    isOwner ? "bg-amber-400/20 text-amber-200" : "bg-white/12 text-cyan-100/80"
                  }`}
                >
                  {isOwner ? "Akses penuh" : "Akses operasional"}
                </span>
              </span>
            </span>
          </div>

          {isOwner ? (
            <Link href="/pengguna" prefetch onClick={() => setOpen(false)} role="menuitem" className={menuLink}>
              <UserCog size={15} className="shrink-0 text-teal-600 dark:text-teal-300" /> Kelola Pengguna
            </Link>
          ) : null}
          <Link href="/ganti-password" prefetch onClick={() => setOpen(false)} role="menuitem" className={menuLink}>
            <KeyRound size={15} className="shrink-0 text-teal-600 dark:text-teal-300" /> Ganti Password
          </Link>
          {isOwner ? (
            <>
              <Link href="/pengaturan" prefetch onClick={() => setOpen(false)} role="menuitem" className={menuLink}>
                <Settings size={15} className="shrink-0 text-teal-600 dark:text-teal-300" /> Pengaturan
              </Link>
              <Link href="/mitra" prefetch onClick={() => setOpen(false)} role="menuitem" className={menuLink}>
                <Factory size={15} className="shrink-0 text-teal-600 dark:text-teal-300" /> Produksi Mitra
              </Link>
            </>
          ) : null}

          <button
            type="button"
            role="menuitem"
            onClick={logout}
            disabled={busy}
            className="mt-1 flex w-full items-center gap-2.5 rounded-xl border-t border-slate-100 px-2.5 py-2.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-white/10 dark:text-rose-300 dark:hover:bg-rose-500/12"
          >
            <LogOut size={15} /> {busy ? "Keluar…" : "Keluar dari perangkat ini"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
