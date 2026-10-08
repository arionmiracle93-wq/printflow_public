"use client";

import { Check, ChevronDown } from "lucide-react";
import { Children, Fragment, isValidElement, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Pengganti <select> bawaan browser.
 *
 * Kenapa dibuat sendiri: daftar pilihan <select> bawaan digambar oleh
 * browser/sistem operasi, jadi tampilannya (font, jarak, warna, sudut)
 * tidak bisa diatur dari CSS dan beda-beda di tiap perangkat. Komponen ini
 * menggambar panelnya sendiri memakai token tema (--pf-*), jadi seragam di
 * HP, desktop, mode terang, dan mode gelap.
 *
 * Cara pakai SAMA dengan <select>: isi dengan <option>, pakai value /
 * defaultValue / onChange / disabled / name / id / className. Handler
 * onChange tetap menerima `e.target.value`, jadi kode lama tidak perlu
 * diubah selain nama tag-nya. Kalau `name` diisi, nilainya ikut terkirim
 * saat <form> disubmit (lewat <input type="hidden">).
 *
 * Keyboard: Enter / Spasi / panah bawah membuka daftar; panah atas-bawah
 * berpindah, Home & End ke awal-akhir, ketik huruf untuk lompat, Enter atau
 * Spasi memilih, Escape menutup. Panel dirender di <body> supaya tidak
 * terpotong kartu atau popup, dan otomatis membuka ke atas kalau ruang di
 * bawah tidak cukup.
 */

export type SelectChangeEvent = {
  target: { value: string; name: string };
  currentTarget: { value: string; name: string };
};

type Opt = { value: string; label: ReactNode; text: string; disabled: boolean };

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

function collectOptions(children: ReactNode, out: Opt[] = []): Opt[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: string | number; disabled?: boolean; children?: ReactNode };
    if (child.type === "option") {
      const text = textOf(props.children);
      out.push({
        value: props.value !== undefined ? String(props.value) : text,
        label: props.children,
        text,
        disabled: Boolean(props.disabled),
      });
    } else if (child.type === Fragment) {
      collectOptions(props.children, out);
    }
  });
  return out;
}

const GAP = 6;
const EDGE = 8;
const MAX_H = 288;
const MIN_PANEL_W = 176;

type Pos = { left: number; width: number; maxHeight: number; top?: number; bottom?: number };

export function Select({
  value,
  defaultValue,
  onChange,
  name,
  id,
  disabled = false,
  className = "input",
  placeholder = "Pilih…",
  title,
  "aria-label": ariaLabel,
  children,
}: {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: SelectChangeEvent) => void;
  name?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  title?: string;
  "aria-label"?: string;
  children?: ReactNode;
}) {
  const autoId = useId();
  const listId = `${autoId}-list`;
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const options = collectOptions(children);
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue !== undefined ? String(defaultValue) : "");
  const current = controlled ? String(value) : inner;

  // Seperti <select> asli: kalau tidak ada yang cocok dan komponen tidak
  // dikontrol, tampilkan pilihan pertama. Kalau dikontrol, tampilkan placeholder.
  const selected = options.find((o) => o.value === current) ?? (controlled ? null : (options[0] ?? null));
  const selectedIndex = selected ? options.indexOf(selected) : -1;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<Pos>({ left: 0, width: 0, maxHeight: MAX_H });

  function place() {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, MIN_PANEL_W), vw - EDGE * 2);
    const left = Math.min(Math.max(EDGE, r.left), vw - width - EDGE);
    const spaceBelow = vh - r.bottom - GAP - EDGE;
    const spaceAbove = r.top - GAP - EDGE;
    const wanted = Math.min(MAX_H, options.length * 44 + 12);
    if (spaceBelow >= wanted || spaceBelow >= spaceAbove) {
      setPos({ left, width, top: r.bottom + GAP, maxHeight: Math.max(120, Math.min(MAX_H, spaceBelow)) });
    } else {
      setPos({ left, width, bottom: vh - r.top + GAP, maxHeight: Math.max(120, Math.min(MAX_H, spaceAbove)) });
    }
  }

  function openList() {
    if (disabled || !options.length) return;
    place();
    setActive(selectedIndex >= 0 ? selectedIndex : Math.max(0, options.findIndex((o) => !o.disabled)));
    setOpen(true);
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function choose(index: number) {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    close();
    if (opt.value === current) return;
    if (!controlled) setInner(opt.value);
    const payload = { value: opt.value, name: name ?? "" };
    onChange?.({ target: payload, currentTarget: payload });
  }

  // Saat terbuka: fokus ke daftar, tutup saat klik di luar, ikuti posisi
  // tombol saat halaman digulir atau jendela berubah ukuran.
  useEffect(() => {
    if (!open) return;
    listRef.current?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!listRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    const onMove = (e?: Event) => {
      if (e && listRef.current?.contains(e.target as Node)) return;
      const btn = buttonRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      // Tombol sudah keluar layar sepenuhnya: tutup saja.
      if (r.bottom < 0 || r.top > window.innerHeight) {
        setOpen(false);
        return;
      }
      place();
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Pilihan aktif selalu terlihat saat berpindah dengan keyboard.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function step(from: number, dir: 1 | -1) {
    let i = from + dir;
    while (i >= 0 && i < options.length) {
      if (!options[i].disabled) return i;
      i += dir;
    }
    return from;
  }

  function onButtonKey(e: React.KeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      if (!open) openList();
    }
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") setActive((a) => step(a, 1));
    else if (e.key === "ArrowUp") setActive((a) => step(a, -1));
    else if (e.key === "Home") setActive(options.findIndex((o) => !o.disabled));
    else if (e.key === "End") {
      for (let i = options.length - 1; i >= 0; i--) {
        if (!options[i].disabled) {
          setActive(i);
          break;
        }
      }
    } else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") {
      close(false);
      return;
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Ketik huruf untuk lompat ke pilihan yang diawali huruf itu.
      const ch = e.key.toLowerCase();
      for (let n = 1; n <= options.length; n++) {
        const i = (active + n) % options.length;
        if (!options[i].disabled && options[i].text.trim().toLowerCase().startsWith(ch)) {
          setActive(i);
          break;
        }
      }
    } else return;
    e.preventDefault();
  }

  const popup = open ? (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={-1}
      aria-activedescendant={`${autoId}-opt-${active}`}
      onKeyDown={onListKey}
      style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
      className="pf-select-pop z-[150] overflow-y-auto overscroll-contain rounded-xl border border-[color:var(--pf-line-strong)] bg-[color:var(--pf-surface-solid)] p-1.5 shadow-[var(--pf-shadow-3)] outline-none"
    >
      {options.map((opt, index) => {
        const isSelected = index === selectedIndex;
        return (
          <li
            key={`${opt.value}-${index}`}
            id={`${autoId}-opt-${index}`}
            data-index={index}
            role="option"
            aria-selected={isSelected}
            aria-disabled={opt.disabled || undefined}
            onMouseEnter={() => !opt.disabled && setActive(index)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(index)}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm leading-snug transition-colors ${
              opt.disabled
                ? "cursor-not-allowed opacity-45"
                : `cursor-pointer ${
                    index === active ? "bg-[color:var(--pf-accent-soft)] text-[color:var(--pf-accent-strong)]" : "text-[color:var(--pf-ink-2)]"
                  }`
            } ${isSelected ? "font-semibold text-[color:var(--pf-ink)]" : "font-medium"}`}
          >
            <span className="min-w-0 flex-1 break-words">{opt.label}</span>
            {isSelected ? <Check size={15} className="shrink-0 text-[color:var(--pf-accent-strong)]" aria-hidden /> : null}
          </li>
        );
      })}
    </ul>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        title={title}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onButtonKey}
        className={`${className} pf-select`}
      >
        <span className="min-w-0 flex-1 truncate">
          {selected ? selected.label : <span className="text-[color:var(--pf-ink-3)]">{placeholder}</span>}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`shrink-0 text-[color:var(--pf-ink-3)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {name ? <input type="hidden" name={name} value={selected?.value ?? ""} disabled={disabled} /> : null}
      {popup ? createPortal(popup, document.body) : null}
    </>
  );
}
