"use client";

/**
 * SAKELAR ON/OFF (gaya tombol pill).
 *
 * Dipakai untuk pilihan yang hanya ya/tidak - misalnya "Perlu monitoring
 * produksi" - supaya tidak terasa seperti formulir yang harus dicentang.
 * Bedanya dengan <input type="checkbox"> bawaan: bentuknya pill, tombolnya
 * lebar dan bisa ditekan, dan status aktifnya jelas dari warna track +
 * posisi knob - bukan sekadar kotak kecil yang harus dicentang.
 *
 * `tone` menentukan warna saat aktif; default "teal" mengikuti aksen aplikasi.
 */
export function ToggleSwitch({
  checked,
  onChange,
  label,
  tone = "teal",
  disabled = false,
  className = "",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Wajib: tombolnya cuma ikon, tanpa teks, jadi harus ada nama yang terbaca screen reader. */
  label: string;
  tone?: "teal" | "green" | "rose" | "sky" | "amber";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`pf-switch pf-switch-${tone} ${checked ? "on" : "off"} ${className}`}
    >
      <span className="pf-switch-knob" aria-hidden />
    </button>
  );
}