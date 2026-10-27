import type { ReactNode } from "react";

export type ExpandingTabItem<T extends string> = {
  value: T;
  label: string;
  icon: ReactNode;
  /** Tooltip (atribut title). Bawaan: label. */
  title?: string;
};

/**
 * Tab ikon yang tab AKTIFNYA melebar jadi pil berisi ikon + label, sedangkan
 * tab lain tinggal ikon. Pindah tab = pil lama mengecil dan pil baru
 * melebar (lebar dianimasikan, teksnya memudar masuk/keluar).
 *
 * Dipakai untuk pilihan satu-dari-beberapa yang jumlahnya sedikit (2-5), mis.
 * tampilan Kartu / Padat / Ringkas di katalog. Karena label hanya tampil di
 * tab aktif, bentuknya tetap muat di layar HP tanpa menyembunyikan label.
 *
 * Gaya ada di globals.css (kelas .etabs / .etab). Komponen ini murni tampilan:
 * tidak punya state, jadi boleh dipakai dari Server maupun Client Component
 * (onChange hanya bisa diisi dari Client Component).
 */
export function ExpandingTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  items: ExpandingTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={`etabs ${className}`.trim()}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            aria-pressed={active}
            aria-label={item.label}
            title={item.title ?? item.label}
            className="etab"
          >
            <span className="etab-ico" aria-hidden="true">
              {item.icon}
            </span>
            <span className="etab-label" aria-hidden="true">
              <span>{item.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
