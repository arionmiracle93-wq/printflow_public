"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Move } from "lucide-react";

const KEY = "pf_invoice_stamp_pos_v1";
const EVENT = "pf-stamp-pos";

type Pos = { x: number; y: number };

function parsePos(raw: string | null): Pos | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Pos;
    return typeof p?.x === "number" && typeof p?.y === "number" ? p : null;
  } catch {
    return null;
  }
}

/* Posisi disimpan di localStorage (preferensi pribadi, bukan data bisnis).
   useSyncExternalStore dipakai supaya komponen ikut sinkron saat nilai
   diubah dari tab lain - pola yang sama dengan draft editor invoice. */
function subscribePos(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function writePos(pos: Pos | null) {
  try {
    if (pos) window.localStorage.setItem(KEY, JSON.stringify(pos));
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage penuh / mode privat: posisi hanya berlaku untuk sesi ini */
  }
}

/**
 * STEMPEL STATUS (LUNAS / DRAFT / BATAL) YANG BISA DIGESER.
 *
 * Dulu posisinya dikunci di kanan atas lewat kelas CSS. Sekarang pemilik
 * bisa menyeretnya ke mana saja yang biasa dipakai (misalnya area tanda
 * tangan), lalu posisinya ikut ke hasil CETAK dan PDF karena keduanya
 * menyalin lembar ini apa adanya.
 *
 * Dua hal yang perlu dijaga:
 *  1. Posisi disimpan sebagai style inline (left/top dalam px), bukan kelas
 *     CSS - supaya saat lembar disalin ke iframe cetak, koordinatnya ikut
 *     terbawa.
 *  2. Stempel tetap dekoratif (aria-hidden) dan tidak menghambat pemakaian
 *     lain: pointer-events hanya aktif pada stempel itu sendiri, dan
 *     touch-action:none supaya di HP juga bisa diseret.
 */
export function DraggableStamp({
  text,
  className,
}: {
  text: string;
  /** Kelas warna, mis. "border-emerald-600 text-emerald-600". */
  className: string;
}) {
  const stored = useSyncExternalStore(subscribePos, () => window.localStorage.getItem(KEY), () => null);
  const saved = useMemo(() => parsePos(stored), [stored]);
  // Posisi sementara selama diseret, supaya tidak menulis localStorage di
  // setiap gerakan mouse.
  const [live, setLive] = useState<Pos | null>(null);
  const [dragging, setDragging] = useState(false);
  const pos = live ?? saved;

  const ref = useRef<HTMLSpanElement | null>(null);
  // Seretan yang sedang berjalan. Disimpan di ref supaya penangan
  // pointermove tidak dibuat ulang tiap gerakan.
  //
  // bbW/bbH = ukuran kotak stempel SESUDAH diputar. Stempel dimiringkan
  // -12deg, jadi kotak visualnya lebih besar daripada kotak layout
  // (offsetWidth/offsetHeight). Batas geser harus dihitung dari yang visual
  // itu - kalau tidak, stempel bisa menggantung keluar kertas.
  const drag = useRef<{ id: number; dx: number; dy: number; bbW: number; bbH: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    const el = ref.current;
    if (!el?.offsetParent) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const a = el.getBoundingClientRect();
    drag.current = { id: e.pointerId, dx: e.clientX - a.left, dy: e.clientY - a.top, bbW: a.width, bbH: a.height };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    const el = ref.current;
    const paper = el?.offsetParent as HTMLElement | null;
    const d = drag.current;
    if (!el || !paper || !d || d.id !== e.pointerId) return;
    const b = paper.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    // Selisih sisi kotak visual terhadap kotak layout; sama untuk kiri & kanan.
    // EPS 1px menutup pembulatan pecahan (lebar kertas bisa 760.5px).
    const EPS = 1;
    const slackX = Math.max(0, (d.bbW - w) / 2) + EPS;
    const slackY = Math.max(0, (d.bbH - h) / 2) + EPS;
    const maxX = Math.max(slackX, b.width - w - slackX);
    const maxY = Math.max(slackY, b.height - h - slackY);
    const x = Math.min(Math.max(slackX, e.clientX - b.left - d.dx), maxX);
    const y = Math.min(Math.max(slackY, e.clientY - b.top - d.dy), maxY);
    setLive({ x: Math.round(x), y: Math.round(y) });
  }

  function endDrag(e: React.PointerEvent) {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    writePos(live);
    setLive(null);
  }

  // Klik ganda = kembalikan ke posisi bawaan (kanan atas).
  function onDoubleClick() {
    writePos(null);
  }

  return (
    <span
      ref={ref}
      aria-hidden
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onDoubleClick}
      title="Seret untuk memindahkan stempel · klik ganda untuk mengembalikan"
      className={`ppi-stamp absolute z-10 -rotate-12 select-none rounded-lg border-4 px-4 py-1 text-3xl font-black tracking-widest opacity-25 ${className} ${
        dragging ? "ppi-stamp-drag" : "ppi-stamp-ready"
      }`}
      style={pos ? { left: pos.x, top: pos.y, right: "auto" } : undefined}
    >
      {text}
    </span>
  );
}

/** Petunjuk kecil di bawah kertas (hanya di layar, tidak ikut cetak). */
export function StampHint() {
  return (
    <p className="ppi-screen-only mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-500">
      <Move size={12} aria-hidden /> Seret stempel untuk memindahkannya · klik ganda untuk mengembalikan
    </p>
  );
}