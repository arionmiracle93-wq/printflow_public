import { Bot } from "lucide-react";

/**
 * Logo aplikasi berbentuk robot/AI dalam bingkai teal, mengikuti referensi brand.
 *
 * `size` dipakai kalau lingkarannya harus pas di dalam bentuk lain -
 * misalnya loader yang menaruh logo di tengah cincin. Kalau tidak diisi,
 * ukurannya tetap seperti biasa (compact 36px / penuh 44px).
 */
export function BrandMark({ compact = false, size }: { compact?: boolean; size?: number }) {
  const box = size ?? (compact ? 36 : 44);
  return (
    <span
      className="relative flex shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-teal-400 via-cyan-500 to-teal-600 text-white shadow-[0_8px_24px_rgba(13,148,136,.28)]"
      style={{ height: box, width: box }}
      aria-hidden="true"
    >
      <Bot size={Math.round(box * (compact ? 20 / 36 : 24 / 44))} strokeWidth={2.3} />
      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#07384f] bg-amber-300" />
    </span>
  );
}
