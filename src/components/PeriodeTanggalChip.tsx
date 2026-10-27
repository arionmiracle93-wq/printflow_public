"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { DateFieldID } from "@/components/DateFieldID";

/**
 * CHIP "Pilih tanggal" untuk daftar Riwayat Dokumen.
 *
 * Halaman daftar adalah Server Component, jadi chip lain (Hari Ini, Kemarin,
 * dst.) cukup <Link>. Hanya chip ini yang perlu state (panel dua tanggal),
 * maka dipisah jadi komponen client kecil.
 *
 * Satu tanggal terisi saja = periode satu hari. Terbalik (dari > sampai)
 * ditukar. Berpindah periode selalu kembali ke halaman 1 (tidak membawa
 * ?hal=). `base` adalah query string tanpa periode dan tanpa halaman
 * (mis. "m=invoice&f=belum") supaya jenis dokumen dan filter status ikut.
 */
export function PeriodeTanggalChip({
  base,
  active,
  activeLabel,
  initialDari,
  initialSampai,
  className,
  activeClassName,
}: {
  base: string;
  active: boolean;
  activeLabel: string;
  initialDari: string;
  initialSampai: string;
  className: string;
  activeClassName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dari, setDari] = useState(initialDari);
  const [sampai, setSampai] = useState(initialSampai);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function terapkan() {
    let a = dari || sampai;
    let b = sampai || dari;
    if (!a || !b) return;
    if (a > b) [a, b] = [b, a];
    const qs = `${base ? `${base}&` : ""}dari=${a}&sampai=${b}`;
    setOpen(false);
    router.push(`/invoice?${qs}`);
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-current={active ? "true" : undefined}
        className={`${active ? activeClassName : className} inline-flex items-center gap-1.5`}
      >
        <CalendarDays size={12} aria-hidden />
        {active ? activeLabel : "Pilih tanggal"}
      </button>
      {open ? (
        <div className="card absolute left-0 top-full z-30 mt-2 w-[min(19rem,86vw)] space-y-3 p-3 shadow-lg">
          <div>
            <span className="label">Dari tanggal</span>
            <DateFieldID value={dari} onChange={setDari} className="input w-full" />
          </div>
          <div>
            <span className="label">Sampai tanggal</span>
            <DateFieldID value={sampai} onChange={setSampai} className="input w-full" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={() => setOpen(false)}>
              Batal
            </button>
            <button type="button" className="btn-primary px-3 py-2 text-xs" disabled={!dari && !sampai} onClick={terapkan}>
              Terapkan
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
