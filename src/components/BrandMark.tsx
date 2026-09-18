/**
 * Marka aplikasi Print Flow.
 *
 * Dulu memakai ikon robot dari pustaka ikon. Versi ini menggambar markanya
 * sendiri: selembar kertas keluar dari mesin cetak, dengan satu titik amber
 * sebagai "lampu siap". Bentuknya dibuat dari garis tebal agar tetap terbaca
 * pada ukuran kecil di HP maupun pada ikon aplikasi 512px.
 */
type Props = {
  compact?: boolean;
  /** Ukuran piksel manual (untuk di dalam tombol atau badge). */
  size?: number;
  /** Latar bening dipakai saat mark sudah dibungkus kotak berwarna sendiri. */
  plain?: boolean;
};

export function BrandMark({ compact = false, size, plain = false }: Props) {
  const box = size ?? (compact ? 36 : 44);
  const radius = size ? Math.max(6, size * .26) : compact ? 12 : 14;

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center ${
        compact ? "shadow-[0_4px_14px_rgba(13,148,136,.25)]" : "shadow-[0_8px_24px_rgba(13,148,136,.28)]"
      }`}
      style={{
        width: box,
        height: box,
        borderRadius: radius,
        background: plain ? undefined : "linear-gradient(145deg,#0f766e 0%,#0d9488 42%,#0e7490 100%)",
      }}
      aria-hidden="true"
    >
      {!plain ? (
        <span
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(120% 80% at 15% 0%, rgba(255,255,255,.32), transparent 55%)" }}
        />
      ) : null}
      <svg
        viewBox="0 0 24 24"
        width={box * .62}
        height={box * .62}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={plain ? "text-teal-700 dark:text-teal-300" : "text-white"}
      >
        {/* rancangan kertas di bagian atas mesin */}
        <path d="M8.6 4v1.9h6.8V4" opacity=".6" />
        {/* badan mesin */}
        <path d="M7 9.4V6.9A1.4 1.4 0 0 1 8.4 5.5h7.2A1.4 1.4 0 0 1 17 6.9v2.5" />
        <rect x="4" y="9.4" width="16" height="7.3" rx="2.1" />
        {/* kertas hasil cetak keluar */}
        <path d="M8 16.7h8v3.3H8z" />
        <path d="M10 18.7h4" opacity=".7" />
      </svg>
      <span
        className="absolute rounded-full bg-amber-300"
        style={{
          width: Math.max(4, box * .1),
          height: Math.max(4, box * .1),
          right: box * .18,
          top: box * .2,
          boxShadow: "0 0 0 2px rgba(7,56,79,.85)",
        }}
      />
    </span>
  );
}
