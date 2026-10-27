"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, CornerDownLeft, Loader2, Phone, ReceiptText, Search, SearchX, UserRound, X } from "lucide-react";
import { formatDateID, formatRupiah, jakartaDateISO, statusMeta } from "@/lib/domain";
import { addDays } from "@/lib/invoice-period";
import { TanggalTrigger } from "@/components/TanggalFieldID";

type OrderHit = { id: number; code: string; title: string; customerName: string; status: string; dueDate: string; dueTime: string };
type CustomerHit = { id: number; name: string; phone: string | null; orders: number };
type InvoiceHit = {
  id: number;
  docType: string;
  number: string | null;
  customerName: string;
  status: string;
  payStatus: string;
  total: number;
  issueDate: string;
};
type Item =
  | { key: string; href: string; kind: "order"; data: OrderHit }
  | { key: string; href: string; kind: "customer"; data: CustomerHit }
  | { key: string; href: string; kind: "invoice"; data: InvoiceHit };

/** Nama jenis dokumen, untuk saat hasil pencarian bercampur. */
const JENIS_DOKUMEN: Record<string, string> = {
  invoice: "Invoice",
  estimasi: "Estimasi",
  suratjalan: "Surat Jalan",
  po: "Purchase Order",
};

/** Warna chip status bayar: hijau lunas, amber sebagian, abu-abu belum. */
const CHIP_BAYAR: Record<string, string> = {
  lunas: "chip border-emerald-200 bg-emerald-50 text-emerald-700",
  sebagian: "chip border-amber-200 bg-amber-50 text-amber-700",
  belum: "chip border-slate-200 bg-slate-50 text-slate-600",
};

const LABEL_BAYAR: Record<string, string> = { lunas: "Lunas", sebagian: "Sebagian", belum: "Belum" };

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
/** Rentang tanggal aktif untuk hasil dokumen. null = tidak difilter.
    BulAN ("yyyy-mm") dan TANGGAL ("yyyy-mm-dd") adalah bentuk lain dari
    filter yang sama, jadi ketiganya tidak pernah aktif bersamaan. */
type RentangTanggal = { dari: string; sampai: string } | null;

/** Chip cepat untuk tanggal dokumen.
    Chip "Bulan Ini" dan "Bulan Lalu" sengaja tidak ada di sini -
    keduanya sudah bisa dipilih bebas lewat tombol bulan di atas. */
const CHIP_TANGGAL: Array<{
  key: string;
  label: string;
  /** Rentang yang dipasang chip ini. */
  rentang: (today: string) => { dari: string; sampai: string };
  /** Apakah rentang sekarang sama dengan milik chip ini. */
  aktif: (r: RentangTanggal) => boolean;
}> = [
  {
    key: "today",
    label: "Hari ini",
    rentang: (today) => ({ dari: today, sampai: today }),
    aktif: (r) => !!r && r.dari === r.sampai && r.dari === hariIni(),
  },
  {
    key: "yesterday",
    label: "Kemarin",
    rentang: (today) => ({ dari: addDays(today, -1), sampai: addDays(today, -1) }),
    aktif: (r) => !!r && r.dari === r.sampai && r.dari === addDays(hariIni(), -1),
  },
  {
    key: "7d",
    label: "7 Hari",
    rentang: (today) => ({ dari: addDays(today, -6), sampai: today }),
    aktif: (r) => !!r && r.dari === addDays(hariIni(), -6) && r.sampai === hariIni(),
  },
  {
    key: "30d",
    label: "30 Hari",
    rentang: (today) => ({ dari: addDays(today, -29), sampai: today }),
    aktif: (r) => !!r && r.dari === addDays(hariIni(), -29) && r.sampai === hariIni(),
  },
];

/** Tanggal hari ini dalam zona waktu bisnis (WIB), format "yyyy-mm-dd". */
function hariIni(): string {
  return jakartaDateISO();
}

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "yyyy-mm-dd" -> "18 Okt". Tahun tidak ikut supaya tidak memenuhi
    tombol yang sempit; kalau melintasi tahun, tambahkan tahun di kedua
    ujung supaya tidak ambigu ("30 Des 2025 – 5 Jan 2026"). */
function tanggalPendek(iso: string): { teks: string; tahun: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return { teks: iso, tahun: "" };
  return { teks: `${Number(m[3])} ${BULAN_PENDEK[Number(m[2]) - 1] ?? m[2]}`, tahun: m[1] };
}

/** Teks rentang aktif untuk ditulis di tombol tanggal, mis. "12 – 18 Okt"
    atau "18 Okt". Satu hari tidak ditulis sebagai "18 Okt – 18 Okt".
    Rentang kosong tidak pernah dipanggil: pemanggil hanya memakai
    teks ini kalau rentang sedang aktif. */
function tampilRentang(r: RentangTanggal): string {
  if (!r) return "";
  const a = tanggalPendek(r.dari);
  const b = tanggalPendek(r.sampai);
  if (a.teks === b.teks && a.tahun === b.tahun) return `${a.teks} ${a.tahun}`;
  const wajibTahun = a.tahun !== b.tahun;
  return `${a.teks}${wajibTahun ? ` ${a.tahun}` : ""} – ${b.teks} ${b.tahun}`;
}

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
  // Filter tanggal untuk hasil dokumen, dalam tiga bentuk yang saling
  // menggantikan: satu bulan (lewat kalender bagian "Bulan"), satu hari
  // (lewat kalender bagian "Tanggal"), atau rentang beberapa hari
  // (lewat chip cepat). Kalau lebih dari satu aktif, hasilnya irisan
  // yang tidak bisa dijelaskan satu kalimat - jadi hanya satu yang boleh.
  const [bulan, setBulan] = useState("");
  const [tanggal, setTanggal] = useState("");
  // Rentang tanggal dokumen yang aktif. Berbeda dari bulan: bulan
  // dipilih lewat kalender (satu bulan bebas), rentang ini dipilih lewat
  // chip cepat (hari ini, kemarin, 7 hari, 30 hari).
  const [rentang, setRentang] = useState<RentangTanggal>(null);
  // Bulan terakhir yang dipilih, disimpan terpisah dari state di atas.
  // State di atas ikut ter-reset kalau panel ditutup (lihat efek
  // "tutupPanel"), padahal filter bulan ini orang biasa ingin tetap
  // ada waktu dia buka panel lagi - terutama untuk memeriksa bulan yang
  // sama berulang kali.
  //
  // Nilai ini juga dibaca hal di luar panel ini: tombol "Ubah bulan"
  // di halaman daftar invoice menyuruh panel ini terbuka dengan bulan
  // yang sedang difilter. Tanpa state terpisah, filter bulan akan
  // hilang tepat setiap kali orang menutup panel - dan filter yang
  // hilang begitu diketuk berarti filter yang tidak bisa dipakai.
  const bulanTerakhir = useRef("");
  // Tanggal terakhir yang dipilih (satu hari), alasan sama seperti di atas.
  const tanggalTerakhir = useRef("");
  // Rentang tanggal terakhir yang dipilih, dengan alasan yang sama:
  // filter tanggal harus bertahan setelah panel ditutup.
  const rentangTerakhir = useRef<RentangTanggal>(null);
  // Hasil dan kegagalan disimpan bersama kata yang dicari, sehingga
  // status "sedang mencari" cukup diturunkan: ada ketikan yang belum punya hasil.
  const [response, setResponse] = useState<{ q: string; orders: OrderHit[]; customers: CustomerHit[]; invoices: InvoiceHit[] } | null>(null);
  const [failure, setFailure] = useState<{ q: string; message: string } | null>(null);
  const [active, setActive] = useState(0);

  const term = q.trim();
  const ready = term.length >= 2;
  const error = ready && failure?.q === term ? failure.message : null;
  const result = ready && response ? response : null;
  const loading = ready && response?.q !== term && failure?.q !== term;

  function show() {
    // Panel dibuka: pulihkan filter tanggal terakhir. Perintah dari luar
    // (tombol "Ubah bulan" di halaman daftar) menyetel bulanTerakhir
    // lebih dulu, jadi show() tidak menimpanya.
    setBulan(bulanTerakhir.current);
    setTanggal(tanggalTerakhir.current);
    setRentang(rentangTerakhir.current);
    setOpenPath(pathname);
  }

  function close(returnFocus = true) {
    setOpenPath(null);
    if (returnFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  /* Satu kalender, dua bentuk hasil: "yyyy-mm-dd" (satu hari) atau
     "yyyy-mm" (satu bulan). Bentuknya dibedakan dari panjang string,
     bukan dari state terpisah - jadi tidak mungkin keduanya aktif. */
  const pilihTanggal = useCallback((v: string) => {
    if (!v) return;
    if (/^\d{4}-\d{2}$/.test(v)) {
      bulanTerakhir.current = v;
      tanggalTerakhir.current = "";
      setBulan(v);
      setTanggal("");
    } else {
      tanggalTerakhir.current = v;
      bulanTerakhir.current = "";
      setTanggal(v);
      setBulan("");
    }
    // Bentuk lain dibuang: hanya satu filter tanggal yang boleh aktif,
    // supaya hasilnya selalu bisa dijelaskan satu kalimat.
    rentangTerakhir.current = null;
    setRentang(null);
  }, []);

  /* Pilih chip cepat.

     Memilih chip yang sudah aktif berarti membatalkan filter itu -
     jadi klik kedua pada chip yang sama mengembalikan ke "tanpa
     filter", bukan menegaskan filter yang sama. */
  function pilihChipTanggal(chip: (typeof CHIP_TANGGAL)[number]) {
    const hari = hariIni();
    if (chip.aktif(rentang)) {
      setRentang(null);
      rentangTerakhir.current = null;
      return;
    }
    const baru = chip.rentang(hari);
    setRentang(baru);
    rentangTerakhir.current = baru;
    // Bulan dan tanggal dilepas: dua bentuk filter tanggal yang aktif
    // bersamaan hanya menghasilkan irisan yang membingungkan.
    setBulan("");
    setTanggal("");
    bulanTerakhir.current = "";
    tanggalTerakhir.current = "";
  }

  function hapusSemuaFilterTanggal() {
    setBulan("");
    setTanggal("");
    setRentang(null);
    bulanTerakhir.current = "";
    tanggalTerakhir.current = "";
    rentangTerakhir.current = null;
  }

  /* Perintah dari luar panel: "buka panel cari, dengan filter tanggal ini".

     Dipakai tombol "Ubah bulan" / "Ubah tanggal" di halaman daftar
     invoice. Tanpa ini, orang yang sedang melihat daftar sebulan harus
     menekan tombol cari di header, mengetik sesuatu, baru bisa mengganti
     bulan - padahal tombolnya ada tepat di halaman yang sedang dibaca.

     Yang dikirim boleh bulan ATAU rentang, tidak keduanya - sama
     denormal dengan aturannya di listInvoices.

     Event ini dipasang sekali seumur komponen, bukan setiap render,
     supaya halaman daftar tidak perlu memasang ulang listener setiap
     kali ada perubahan. */
  useEffect(() => {
    type Detail = { bulan?: string; dari?: string; sampai?: string };
    const onPerintah = (e: Event) => {
      const d = (e as CustomEvent<Detail>).detail;
      const dari = typeof d?.dari === "string" ? d.dari : "";
      const sampai = typeof d?.sampai === "string" ? d.sampai : "";
      if (dari && sampai) {
        rentangTerakhir.current = { dari, sampai };
        setRentang(rentangTerakhir.current);
        bulanTerakhir.current = "";
        tanggalTerakhir.current = "";
        setBulan("");
        setTanggal("");
      } else {
        const bulan = d?.bulan;
        if (bulan === undefined) return;
        bulanTerakhir.current = bulan;
        setBulan(bulan);
        tanggalTerakhir.current = "";
        setTanggal("");
        rentangTerakhir.current = null;
        setRentang(null);
      }
      setOpenPath(pathname);
    };
    window.addEventListener("printflow:buka-pencarian", onPerintah);
    return () => window.removeEventListener("printflow:buka-pencarian", onPerintah);
  }, [pathname]);

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
        const params = new URLSearchParams({ q: term });
        // Filter tanggal hanya ikut kalau sedang dipakai. Tanpa ini,
        // parameter kosong tetap terkirim dan server akan selalu menyaring.
        if (bulan) params.set("bulan", bulan);
        if (tanggal) params.set("tanggal", tanggal);
        if (rentang) {
          params.set("dari", rentang.dari);
          params.set("sampai", rentang.sampai);
        }
        const res = await fetch(`/api/search?${params}`, { signal: controller.signal });
        const json = (await res.json()) as {
          ok: boolean;
          orders?: OrderHit[];
          customers?: CustomerHit[];
          invoices?: InvoiceHit[];
          error?: string;
        };
        if (!json.ok) {
          setFailure({ q: term, message: json.error ?? "Pencarian gagal." });
        } else {
          setResponse({
            q: term,
            orders: json.orders ?? [],
            customers: json.customers ?? [],
            // Dokumen tidak selalu dikirim: karyawan tanpa izin invoice
            // tidak akan menerimanya sama sekali dari server.
            invoices: json.invoices ?? [],
          });
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
  }, [term, bulan, tanggal, rentang, ready, open]);

  /* Urutan hasil: pekerjaan, dokumen, pelanggan.
     Dokumen diletakkan DI TENGAH, bukan di akhir, karena yang dicari
     dari kotak ini paling sering dokumen - nomornya atau nominal
     transfernya. Pelanggan tetap terakhir karena hasilnya cuma
     daftar, bukan dokumen yang bisa langsung dibuka. */
  const items: Item[] = useMemo(() => {
    if (!result) return [];
    return [
      ...result.orders.map((o) => ({ key: `o${o.id}`, href: `/pesanan/${o.id}`, kind: "order" as const, data: o })),
      ...result.invoices.map((v) => ({ key: `v${v.id}`, href: `/invoice/${v.id}`, kind: "invoice" as const, data: v })),
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

  /* Letak judul kelompok: peta indeks hasil -> judul di atasnya.
     Versi sebelumnya memakai perbandingan indeks dengan jumlah
     hasil ("index === orderCount"), yang rapuh begitu ada kelompok
     ketiga di tengah: satu kelompok kosong di tengah membuat semua
     judul sesudahnya bergeser dan "Pelanggan" muncul di atas daftar
     yang sebenarnya pekerjaan.

     Peta ini dihitung dari panjang tiap kelompok, jadi kelompok
     kosong hanya berarti tidak ada judul untuknya - bukan judul yang
     salah tempat.

     Urutan kelompok harus sama persis dengan urutan di `items` di
     atas. Kalau ditambah kelompok baru di sini tapi lupa di `items`,
     judulnya akan muncul di atas daftar yang isinya bukan kelompok
     itu - jadi lebih baik keduanya diturunkan dari satu daftar. */
  const headings = useMemo(() => {
    const map = new Map<number, string>();
    if (!result) return map;
    const groups: Array<[string, number]> = [
      ["Pekerjaan", result.orders.length],
      ["Invoice", result.invoices.length],
      ["Pelanggan", result.customers.length],
    ];
    let i = 0;
    for (const [judul, jumlah] of groups) {
      if (jumlah > 0) map.set(i, judul);
      i += jumlah;
    }
    return map;
  }, [result]);

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
            aria-label="Cari pekerjaan, pelanggan, nomor invoice, atau nominal transfer"
            placeholder="Kode PJ, pelanggan, nomor invoice, atau nominal transfer"
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

        {/* Filter bulan, tepat DI BAWAH kolom ketik.

      Kenapa bukan menyatu dengan kolom ketik: kolom ketik itu untuk
      teks (nomor, nama, nominal), dan menyaring dokumen per bulan di
      sana akan membikin orang yang sedang mengetik angka terganggu -
      satu filter muncul-timbul setiap kali orang mau mengetik "150000".

      Kenapa tidak di footer: orang yang menyaring dokumen hampir selalu
      membuka panel ini untuk menyaring lebih dulu, jadi tempatnya
      harus langsung terlihat tanpa menggulir. */}
        <div className="shrink-0 border-t border-[color:var(--pf-line-soft)] px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[color:var(--pf-ink-3)]">Tanggal</span>
            {/* Satu tombol untuk tiga bentuk filter: satu hari, satu
                bulan, atau rentang dari chip di bawahnya.

                Nilai yang diteruskan ke TanggalTrigger adalah bulan atau
                tanggal yang sedang aktif. Kalau yang aktif justru rentang
                dari chip, teks rentangnya dipakai sebagai placeholder -
                supaya keadaan sebenarnya terlihat di tombol, bukan
                "Pilih tanggal" padahal sedang menyaring. */}
            <TanggalTrigger
              className="min-w-0 flex-1 rounded-lg bg-[color:var(--pf-surface-2)] px-2.5 py-1.5 text-[13px] font-semibold text-[color:var(--pf-ink)]"
              label="Filter tanggal dokumen"
              nilai={bulan || tanggal || undefined}
              placeholder={rentang ? tampilRentang(rentang) : "Pilih tanggal"}
              onPilih={pilihTanggal}
            />
            {bulan || tanggal || rentang ? (
              <button
                type="button"
                onClick={hapusSemuaFilterTanggal}
                className="pf-icon-btn h-7 w-7 shrink-0"
                aria-label="Hapus filter tanggal"
                title="Hapus filter tanggal"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {/* CHIP CEPAT
              Pintasan yang paling sering dipakai: hari ini, kemarin,
              dan berapa hari terakhir. Semuanya tentang TANGGAL DOKUMEN.

              Chip "Bulan Ini" dan "Bulan Lalu" sengaja TIDAK di sini:
              keduanya sudah bisa dipilih bebas lewat tombol bulan di
              atas, jadi mengulangnya cuma menambah dua chip yang
              sebenarnya sama saja.

              Chip aktif diberi tanda centang, dan satu chip =
              satu filter. Memilih chip lain menggantikan yang lama,
              bukan menumpuk - hasil yang muncul harus selalu bisa
              dijelaskan dengan satu kalimat.

              Tombol "Lihat semua" yang dulu ada di baris ini sudah
              DIHAPUS. Alasannya dua:

              1. Di layar HP baris ini sudah tidak muat - tombolnya
                 keluar dari panel dan terpotong di tepi kanan.
              2. Panel cari bukan untuk menelusuri daftar. Ia untuk
                 menemukan satu hal spesifik: satu invoice, satu
                 pelanggan, satu pekerjaan. Kalau memang mau melihat
                 semuanya, tujuannya sudah jelas - menu Invoice di
                 bagian atas, atau tombol Invoice pada navigasi bawah.

              Karena itu panel ini sengaja dibatasi: paling banyak 8
              hasil per kelompok, dan tidak ada jalan "tampilkan
              seluruhnya" dari sini. */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CHIP_TANGGAL.map((chip) => {
              const aktif = chip.aktif(rentang);
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => pilihChipTanggal(chip)}
                  aria-pressed={aktif}
                  className={
                    "pf-tag cursor-pointer px-2.5 py-1 " +
                    (aktif ? "bg-[color:var(--pf-accent)] text-white" : "hover:text-[color:var(--pf-accent-strong)]")
                  }
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Isi */}
        <div ref={listRef} id={`${id}-list`} role="listbox" aria-label="Hasil pencarian" className="min-h-0 flex-1 overflow-y-auto p-2">
          {term.length < 2 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-[13px] text-[color:var(--pf-ink-2)]">Ketik minimal 2 huruf atau angka.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {["PJ-2026", "berkah", "INV-2026", "150000"].map((ex) => (
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
              <p className="mt-1 text-xs text-[color:var(--pf-ink-3)]">Coba sebagian kode (0002), sebagian nama, atau nominal transfer.</p>
            </div>
          ) : (
            items.map((item, index) => {
              const selected = index === active;
              const heading = headings.get(index) ?? null;
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
                    {item.kind === "order" ? (
                      <OrderRow o={item.data} />
                    ) : item.kind === "invoice" ? (
                      <InvoiceRow v={item.data} />
                    ) : (
                      <CustomerRow c={item.data} />
                    )}
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
        aria-label="Cari pekerjaan, pelanggan, atau invoice"
        title="Cari (Ctrl+K)"
        className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--pf-line)] bg-[color:var(--pf-surface-2)] text-[color:var(--pf-ink)] transition-all hover:border-[color:var(--pf-accent-line)] hover:bg-[color:var(--pf-accent-soft)] md:ml-0 md:h-9 md:w-9"
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

/* Baris hasil dokumen. Nomor dokumen ditampilkan sebagai kode
   seperti nomor pekerjaan, supaya cara membacanya sama.
   Nominal ditampilkan apa adanya karena justru nominal itulah
   yang dicari orang saat mencocokkan mutasi bank. */
function InvoiceRow({ v }: { v: InvoiceHit }) {
  const bayar = v.payStatus;
  return (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--pf-surface-2)] text-[color:var(--pf-ink-3)]">
        <ReceiptText size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="pf-mono shrink-0 text-[11px] text-[color:var(--pf-accent-strong)]">{v.number ?? "(tanpa nomor)"}</span>
          <span className="truncate text-[13px] font-semibold text-[color:var(--pf-ink)]">{v.customerName}</span>
        </span>
        <span className="block truncate text-[11px] text-[color:var(--pf-ink-3)]">
          {JENIS_DOKUMEN[v.docType] ?? "Dokumen"} · {formatDateID(v.issueDate)} ·{" "}
          <span className="pf-num font-semibold">{formatRupiah(v.total)}</span>
        </span>
      </span>
      <span className={`${CHIP_BAYAR[bayar] ?? CHIP_BAYAR.belum} shrink-0`}>{LABEL_BAYAR[bayar] ?? "Belum"}</span>
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
