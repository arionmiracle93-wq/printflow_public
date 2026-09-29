"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, CornerDownLeft, Loader2, Phone, Search, SearchX, UserRound, X } from "lucide-react";
import { formatDateID, statusMeta } from "@/lib/domain";

type OrderHit = { id: number; code: string; title: string; customerName: string; status: string; dueDate: string; dueTime: string };
type CustomerHit = { id: number; name: string; phone: string | null; orders: number };
type Item = { key: string; href: string; kind: "order"; data: OrderHit } | { key: string; href: string; kind: "customer"; data: CustomerHit };

/**
 * PENCARIAN CEPAT DI HEADER
 * ---------------------------------------------------------------------
 * Tombol ikon kaca pembesar di header, ada di semua halaman. Membuka
 * jendela pencarian untuk kode PJ, nama pekerjaan, nama pelanggan, atau
 * nomor HP.
 *
 * Pintasan keyboard (desktop): Ctrl+K / Cmd+K, atau tombol "/" saat tidak
 * sedang mengetik. Panah atas/bawah memilih, Enter membuka, Esc menutup.
 *
 * Pola aksesibilitas: combobox + listbox (WAI-ARIA), fokus kembali ke
 * tombol setelah jendela ditutup.
 */
export function QuickSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  // Jendela dianggap terbuka hanya di halaman tempat ia dibuka, jadi
  // otomatis tertutup setelah pindah halaman tanpa efek tambahan.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const [q, setQ] = useState("");
  // Hasil dan kegagalan disimpan bersama kata yang dicari, sehingga
  // status "sedang mencari" cukup diturunkan: ada ketikan yang belum punya hasil.
  const [response, setResponse] = useState<{ q: string; orders: OrderHit[]; customers: CustomerHit[] } | null>(null);
  const [failure, setFailure] = useState<{ q: string; message: string } | null>(null);
  const [active, setActive] = useState(0);

  const term = q.trim();
  const ready = term.length >= 2;
  const error = ready && failure?.q === term ? failure.message : null;
  const result = ready && response ? response : null;
  const loading = ready && response?.q !== term && failure?.q !== term;

  function show() {
    setOpenPath(pathname);
  }

  function close(returnFocus = true) {
    setOpenPath(null);
    if (returnFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  // Pintasan keyboard global.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpenPath((current) => (current === pathname ? null : pathname));
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setOpenPath(pathname);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname]);

  // Saat terbuka: kunci gulir halaman dan fokus ke kotak ketik.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => inputRef.current?.select(), 0);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Cari ke server, ditunda 200 ms setelah berhenti mengetik. Permintaan
  // lama dibatalkan supaya hasil yang tampil selalu sesuai ketikan terakhir.
  useEffect(() => {
    if (!open || !ready) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const json = (await res.json()) as { ok: boolean; orders?: OrderHit[]; customers?: CustomerHit[]; error?: string };
        if (!json.ok) {
          setFailure({ q: term, message: json.error ?? "Pencarian gagal." });
        } else {
          setResponse({ q: term, orders: json.orders ?? [], customers: json.customers ?? [] });
          setActive(0);
        }
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") setFailure({ q: term, message: "Tidak dapat menghubungi server." });
      }
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term, ready, open]);

  const items: Item[] = useMemo(() => {
    if (!result) return [];
    return [
      ...result.orders.map((o) => ({ key: `o${o.id}`, href: `/pesanan/${o.id}`, kind: "order" as const, data: o })),
      ...result.customers.map((c) => ({
        key: `c${c.id}`,
        href: `/pesanan?scope=semua&q=${encodeURIComponent(c.name)}`,
        kind: "customer" as const,
        data: c,
      })),
    ];
  }, [result]);

  // Pilihan aktif selalu terlihat saat berpindah dengan keyboard.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(item: Item | undefined) {
    if (!item) return;
    close(false);
    router.push(item.href);
  }

  function onOptionClick(e: React.MouseEvent<HTMLElement>) {
    go(items[Number(e.currentTarget.dataset.index)]);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  const orderCount = result?.orders.length ?? 0;
  const showEmpty = !loading && !error && result && result.q === term && items.length === 0;

  const dialog = open ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pencarian cepat"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="fixed inset-0 z-[110] flex items-start justify-center bg-[#021c29]/80 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-6 sm:pt-[12vh]"
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[color:var(--pf-line)] bg-[color:var(--pf-surface-solid)] shadow-[var(--pf-shadow-3)] sm:max-h-[70vh]">
        {/* Kotak ketik */}
        <div className="flex items-center gap-2.5 border-b border-[color:var(--pf-line-soft)] px-3.5">
          {loading ? (
            <Loader2 size={18} className="shrink-0 animate-spin text-[color:var(--pf-accent-strong)]" aria-hidden />
          ) : (
            <Search size={18} className="shrink-0 text-[color:var(--pf-ink-3)]" aria-hidden />
          )}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKey}
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls={`${id}-list`}
            aria-activedescendant={items[active] ? `${id}-${items[active].key}` : undefined}
            aria-autocomplete="list"
            aria-label="Cari kode PJ, nama pelanggan, atau nomor HP"
            placeholder="Kode PJ, nama pelanggan, atau nomor HP"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-[color:var(--pf-ink)] outline-none placeholder:text-[color:var(--pf-ink-3)]"
          />
          {q ? (
            <button type="button" onClick={() => { setQ(""); inputRef.current?.focus(); }} className="pf-icon-btn h-8 w-8" aria-label="Hapus ketikan">
              <X size={15} />
            </button>
          ) : null}
          <button type="button" onClick={() => close()} className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-[color:var(--pf-ink-3)] hover:text-[color:var(--pf-ink)]">
            <span className="hidden sm:inline">Esc</span>
            <span className="sm:hidden">Tutup</span>
          </button>
        </div>

        {/* Isi */}
        <div ref={listRef} id={`${id}-list`} role="listbox" aria-label="Hasil pencarian" className="min-h-0 flex-1 overflow-y-auto p-2">
          {term.length < 2 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-[13px] text-[color:var(--pf-ink-2)]">Ketik minimal 2 huruf atau angka.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {["PJ-2026", "berkah", "0812"].map((ex) => (
                  <button key={ex} type="button" onClick={() => setQ(ex)} className="pf-tag cursor-pointer px-2.5 py-1 hover:text-[color:var(--pf-accent-strong)]">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : error ? (
            <p role="alert" className="px-3 py-6 text-center text-[13px] text-[color:var(--pf-danger)]">{error}</p>
          ) : !result && loading ? (
            <div className="space-y-2 p-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <div className="pf-skel h-9 w-9 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="pf-skel h-3 w-2/3" />
                    <div className="pf-skel h-2.5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : showEmpty ? (
            <div className="flex flex-col items-center px-3 py-8 text-center">
              <SearchX size={26} className="text-[color:var(--pf-ink-3)]" aria-hidden />
              <p className="mt-2 text-[13px] font-semibold text-[color:var(--pf-ink)]">Tidak ada yang cocok dengan &ldquo;{result?.q}&rdquo;</p>
              <p className="mt-1 text-xs text-[color:var(--pf-ink-3)]">Coba sebagian kode (misalnya 0002) atau sebagian nama.</p>
            </div>
          ) : (
            items.map((item, index) => {
              const selected = index === active;
              const heading =
                index === 0 && item.kind === "order" ? "Pekerjaan" : index === orderCount && item.kind === "customer" ? "Pelanggan" : null;
              return (
                <div key={item.key}>
                  {heading ? <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold text-[color:var(--pf-ink-3)]">{heading}</p> : null}
                  <div
                    id={`${id}-${item.key}`}
                    data-index={index}
                    role="option"
                    aria-selected={selected}
                    onMouseMove={() => setActive(index)}
                    onClick={onOptionClick}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 ${selected ? "bg-[color:var(--pf-accent-soft)]" : ""}`}
                  >
                    {item.kind === "order" ? <OrderRow o={item.data} /> : <CustomerRow c={item.data} />}
                    {selected ? <CornerDownLeft size={14} className="hidden shrink-0 text-[color:var(--pf-accent-strong)] sm:block" aria-hidden /> : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden items-center gap-4 border-t border-[color:var(--pf-line-soft)] px-4 py-2 text-[11px] text-[color:var(--pf-ink-3)] sm:flex">
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> pilih</span>
          <span><Kbd>Enter</Kbd> buka</span>
          <span><Kbd>Esc</Kbd> tutup</span>
          <span className="ml-auto"><Kbd>Ctrl</Kbd> <Kbd>K</Kbd> dari halaman mana saja</span>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-label="Cari pekerjaan atau pelanggan"
        title="Cari (Ctrl+K)"
        className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition-all hover:bg-white/20 md:ml-0 md:h-9 md:w-9"
      >
        <Search size={18} />
      </button>
      {dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}

function OrderRow({ o }: { o: OrderHit }) {
  const meta = statusMeta(o.status);
  return (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--pf-surface-2)] text-[color:var(--pf-ink-3)]">
        <ClipboardList size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="pf-mono shrink-0 text-[11px] text-[color:var(--pf-accent-strong)]">{o.code}</span>
          <span className="truncate text-[13px] font-semibold text-[color:var(--pf-ink)]">{o.title}</span>
        </span>
        <span className="block truncate text-[11px] text-[color:var(--pf-ink-3)]">
          {o.customerName}, tenggat {formatDateID(o.dueDate)} {o.dueTime}
        </span>
      </span>
      <span className={`chip shrink-0 ${meta.badge}`}>{meta.short}</span>
    </>
  );
}

function CustomerRow({ c }: { c: CustomerHit }) {
  return (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--pf-surface-2)] text-[color:var(--pf-ink-3)]">
        <UserRound size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-[color:var(--pf-ink)]">{c.name}</span>
        <span className="flex items-center gap-1 truncate text-[11px] text-[color:var(--pf-ink-3)]">
          {c.phone ? (
            <>
              <Phone size={11} className="shrink-0" /> {c.phone}
              <span aria-hidden>,</span>
            </>
          ) : null}
          <span className="pf-num">{c.orders}</span> pekerjaan
        </span>
      </span>
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-[color:var(--pf-line)] bg-[color:var(--pf-surface-2)] px-1.5 py-0.5 font-sans text-[10px] font-medium text-[color:var(--pf-ink-2)]">
      {children}
    </kbd>
  );
}
