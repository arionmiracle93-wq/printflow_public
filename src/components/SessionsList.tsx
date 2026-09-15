"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Smartphone, Monitor } from "lucide-react";
import { formatDateTimeID } from "@/lib/domain";
import type { ActiveSession } from "@/lib/auth";

function deviceLabel(userAgent: string | null): { label: string; mobile: boolean } {
  if (!userAgent) return { label: "Perangkat tidak dikenal", mobile: false };
  const ua = userAgent.toLowerCase();
  const mobile = /android|iphone|ipad|mobile/.test(ua);
  let os = "Perangkat";
  if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os")) os = "Mac";
  else if (ua.includes("linux")) os = "Linux";
  let browser = "Browser";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/")) browser = "Chrome";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/")) browser = "Safari";
  return { label: `${browser} di ${os}`, mobile };
}

export function SessionsList({ sessions }: { sessions: ActiveSession[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);

  async function revoke(id: number) {
    if (!window.confirm("Logout paksa perangkat ini?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        alert(json.error ?? "Gagal logout perangkat.");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (!sessions.length) {
    return <p className="card p-6 text-center text-sm text-slate-500">Tidak ada sesi aktif.</p>;
  }

  return (
    <div className="card divide-y divide-slate-100 dark:divide-white/5">
      {sessions.map((s) => {
        const device = deviceLabel(s.userAgent);
        return (
          <div key={s.id} className="flex items-start justify-between gap-3 p-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="icon-tile">{device.mobile ? <Smartphone size={16} /> : <Monitor size={16} />}</span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
                  {s.userName}
                  {s.isCurrent ? <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">Perangkat ini</span> : null}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {device.label}
                  {s.ip ? ` · ${s.ip}` : ""}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  Login {formatDateTimeID(s.createdAt)} · Terakhir aktif {formatDateTimeID(s.lastSeenAt)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => revoke(s.id)}
              disabled={busyId === s.id}
              className="btn-danger shrink-0 px-3 py-2 text-xs"
              title="Logout perangkat ini"
            >
              <LogOut size={13} /> {busyId === s.id ? "…" : "Logout"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
