"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Input teks + panel saran, pengganti `<input list="...">` + `<datalist>`.
 *
 * Kenapa dibuat sendiri: daftar saran datalist digambar oleh browser/OS,
 * jadi tampilannya tidak bisa diatur dan beda-beda di tiap perangkat. Di
 * sini panelnya memakai token tema (--pf-*) dan gaya yang sama dengan
 * komponen <Select>.
 *
 * Beda dengan <Select>: pengguna BOLEH mengetik nilai bebas (tidak harus
 * memilih dari saran). Saran disaring saat mengetik; ikon panah di kanan
 * membuka seluruh daftar.
 *
 * Keyboard: panah atas-bawah berpindah, Enter memilih saran yang disorot,
 * Escape menutup. Panel dirender di <body> supaya tidak terpotong kartu,
 * dan membuka ke atas kalau ruang di bawah tidak cukup.
 */

const GAP = 6;
const EDGE = 8;
const MAX_H = 240;
const MIN_PANEL_W = 176;

type Pos = { left: number; width: number; maxHeight: number; top?: number; bottom?: number };

export function ComboInput({
  value,
  onChange,
  options,
  placeholder,
  className = "input",
  id,
  disabled = false,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const autoId = useId();
  const listId = `${autoId}-list`;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const [open, setOpen] = useState(false);
  // true = pengguna sedang mengetik -> saran disaring; false = tampilkan semua.
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<Pos>({ left: 0, width: 0, maxHeight: MAX_H });

  const query = value.trim().toLowerCase();
  const unique = Array.from(new Set(options.map((o) => o.trim()).filter(Boolean)));
  const visible = typed && query ? unique.filter((o) => o.toLowerCase().includes(query)) : unique;
  const showPanel = open && visible.length > 0;

  function place() {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, MIN_PANEL_W), vw - EDGE * 2);
    const left = Math.min(Math.max(EDGE, r.left), vw - width - EDGE);
    const spaceBelow = vh - r.bottom - GAP - EDGE;
    const spaceAbove = r.top - GAP - EDGE;
    const wanted = Math.min(MAX_H, visible.length * 44 + 12);
    if (spaceBelow >= wanted || spaceBelow >= spaceAbove) {
      setPos({ left, width, top: r.bottom + GAP, maxHeight: Math.max(120, Math.min(MAX_H, spaceBelow)) });
    } else {
      setPos({ left, width, bottom: vh - r.top + GAP, maxHeight: Math.max(120, Math.min(MAX_H, spaceAbove)) });
    }
  }

  function openList(showAll: boolean) {
    if (disabled) return;
    setTyped(!showAll);
    setActive(-1);
    place();
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function choose(option: string) {
    onChange(option);
    setTyped(false);
    close();
    inputRef.current?.focus();
  }

  // Saat terbuka: tutup saat klik di luar, ikuti posisi saat digulir / resize.
  useEffect(() => {
    if (!showPanel) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!listRef.current?.contains(t) && !wrapRef.current?.contains(t)) setOpen(false);
    };
    const onMove = (e?: Event) => {
      if (e && listRef.current?.contains(e.target as Node)) return;
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
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
  }, [showPanel]);

  // Saran yang disorot selalu terlihat saat berpindah dengan keyboard.
  useEffect(() => {
    if (!showPanel || active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, showPanel]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!showPanel) {
        openList(true);
        return;
      }
      const last = visible.length - 1;
      setActive((a) => (e.key === "ArrowDown" ? (a >= last ? 0 : a + 1) : a <= 0 ? last : a - 1));
    } else if (e.key === "Enter") {
      if (showPanel && active >= 0 && visible[active]) {
        e.preventDefault();
        choose(visible[active]);
      }
    } else if (e.key === "Escape") {
      if (showPanel) {
        e.preventDefault();
        close();
      }
    } else if (e.key === "Tab") {
      close();
    }
  }

  const popup = showPanel ? (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
      className="pf-select-pop z-[150] overflow-y-auto overscroll-contain rounded-xl border border-[color:var(--pf-line-strong)] bg-[color:var(--pf-surface-solid)] p-1.5 shadow-[var(--pf-shadow-3)] outline-none"
    >
      {visible.map((option, index) => {
        const isCurrent = option.toLowerCase() === value.trim().toLowerCase();
        return (
          <li
            key={option}
            id={`${autoId}-opt-${index}`}
            data-index={index}
            role="option"
            aria-selected={isCurrent}
            onMouseEnter={() => setActive(index)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(option)}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm leading-snug transition-colors ${
              index === active ? "bg-[color:var(--pf-accent-soft)] text-[color:var(--pf-accent-strong)]" : "text-[color:var(--pf-ink-2)]"
            } ${isCurrent ? "font-semibold text-[color:var(--pf-ink)]" : "font-medium"}`}
          >
            <span className="min-w-0 flex-1 break-words">{option}</span>
            {isCurrent ? <Check size={15} className="shrink-0 text-[color:var(--pf-accent-strong)]" aria-hidden /> : null}
          </li>
        );
      })}
    </ul>
  ) : null;

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={showPanel ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && active >= 0 ? `${autoId}-opt-${active}` : undefined}
        aria-label={ariaLabel}
        autoComplete="off"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setTyped(true);
          setActive(-1);
          if (!open) {
            place();
            setOpen(true);
          }
        }}
        onFocus={() => {
          if (!open && unique.length) openList(true);
        }}
        onKeyDown={onKeyDown}
        className={`${className} pr-10`}
      />
      {unique.length > 0 ? (
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Tampilkan saran"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (showPanel) close();
            else {
              inputRef.current?.focus();
              openList(true);
            }
          }}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[color:var(--pf-ink-3)] hover:text-[color:var(--pf-accent-strong)] disabled:cursor-not-allowed"
        >
          <ChevronDown size={16} aria-hidden className={`transition-transform duration-150 ${showPanel ? "rotate-180" : ""}`} />
        </button>
      ) : null}
      {popup ? createPortal(popup, document.body) : null}
    </div>
  );
}
