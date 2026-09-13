import { Bot } from "lucide-react";

/** Logo aplikasi berbentuk robot/AI dalam bingkai teal, mengikuti referensi brand. */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-teal-400 via-cyan-500 to-teal-600 text-white shadow-[0_8px_24px_rgba(13,148,136,.28)] ${
        compact ? "h-9 w-9" : "h-11 w-11"
      }`}
      aria-hidden="true"
    >
      <Bot size={compact ? 20 : 24} strokeWidth={2.3} />
      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#07384f] bg-amber-300" />
    </span>
  );
}
