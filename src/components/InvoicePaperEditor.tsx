"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  ChevronRight,
  CircleCheck,
  CreditCard,
  Factory,
  Package,
  Calculator,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
  User,
  UserRound,
  ReceiptText,
  CalendarDays,
  ShoppingCart,
  ScrollText,
} from "lucide-react";
import { DateFieldID } from "@/components/DateFieldID";
import { TimeFieldID } from "@/components/TimeFieldID";
import { AccentLastWord } from "@/components/AccentLastWord";
import { Select } from "@/components/Select";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { CatalogPicker } from "@/components/CatalogPicker";
import { CatalogSetPriceDialog } from "@/components/CatalogPriceDialog";
import { AskPaidModal, CustomerModal, M2CalcModal, TierModal, fmtDec } from "@/components/InvoiceEditorModals";
import { PaperLogo } from "@/components/PaperLogo";
import { InvoicePayPanel } from "@/components/InvoicePayPanel";
import { InvoiceSignature } from "@/components/InvoiceSignature";
import { InvoiceFrame, InvoiceSidebar, SideButton } from "@/components/InvoiceSidebar";
import { EditRow } from "@/components/EditRow";
import { formatDateID, formatRupiah } from "@/lib/domain";
import { DOC_MODES, docModeOf, type DocType } from "@/lib/invoice-modes";
import { computePayInfo } from "@/lib/invoice-pay";
import {
  PAY_METHODS,
  computeInvoiceTotals,
  computeRowPricing,
  parseLooseNumber,
  type DiscountType,
  type TierConfig,
} from "@/lib/invoice-pricing";
import { leafItems } from "@/lib/catalog-variants";
import { matchCatalog, type CatalogItem } from "@/lib/invoice-catalog-match";
import type { InvoiceSettings } from "@/lib/invoice-settings";

/**
 * EDITOR INVOICE BERGAYA KERTAS (meniru app lama)
 * Kertas sekaligus jadi tempat mengisi: tabel item, kalkulator m² di kolom
 * M² BAHAN, tombol harga bertingkat di kolom HARGA, bar Data Customer,
 * panel pembayaran & total, syarat & ketentuan.
 *
 * Angka di layar hanya PRATINJAU. Saat disimpan, server menghitung ulang
 * dengan rumus yang sama (src/lib/invoice-pricing.ts) - itulah angka resmi.
 */

export type EditorCustomer = { id: number; name: string; phone: string | null };

export type EditorInitial = {
  id?: number;
  version?: number;
  status?: "draft" | "terbit" | "batal";
  number?: string | null;
  docType: DocType;
  customerName: string;
  customerPhone: string;
  issueDate: string;
  dueDate: string;
  payMethod: string;
  discountType: DiscountType;
  discountInput: number;
  taxRate: number;
  notes: string;
  terms: string[];
  /** Jumlah pembayaran yang sudah masuk (untuk nominal sisa & kode unik). */
  paidAmount?: number;
  needsProduction?: boolean;
  prodDueDate?: string;
  prodDueTime?: string;
  items: {
    lineKey?: string | null;
    productName: string;
    description: string;
    unit: string;
    qty: number;
    areaM2: number;
    basePrice: number;
    tiers: TierConfig | null;
    needsProduction?: boolean;
    prodDueDate?: string | null;
    prodDueTime?: string | null;
  }[];
};

type ItemState = {
  key: number;
  lineKey: string;
  productName: string;
  description: string;
  unit: string;
  qty: string;
  areaM2: string;
  basePrice: string;
  tiers: TierConfig | null;
  needsProduction: boolean;
  prodDueDate: string;
  prodDueTime: string;
};

const DRAFT_KEY = "pf_invoice_draft_v1";
const DRAFT_EVENT = "pf-invoice-draft";

let keyCounter = 1;

/** Kunci stabil baris. Bertahan saat invoice disimpan & diedit ulang. */
function newLineKey(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  } catch {
    /* browser lama / SSR tanpa crypto */
  }
  return `line-${Date.now().toString(36)}-${keyCounter++}`;
}

function blankItem(): ItemState {
  return {
    key: keyCounter++,
    lineKey: newLineKey(),
    productName: "",
    description: "",
    unit: "pcs",
    qty: "1",
    areaM2: "",
    basePrice: "",
    tiers: null,
    needsProduction: true,
    prodDueDate: "",
    prodDueTime: "",
  };
}

/** "25000" -> "25.000" (tampilan ribuan gaya Indonesia saat mengetik). */
function thousands(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("id-ID") : "";
}

function numText(n: number): string {
  return n ? String(n).replace(".", ",") : "";
}

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/**
 * Samakan tinggi textarea dengan isinya (kolom Produk & Keterangan).
 *
 * `scrollHeight` hanya menghitung padding + isi, TIDAK border. Karena .ppi-in
 * memakai box-sizing: border-box, tinggi yang pas `scrollHeight` selalu kurang
 * 2px. Dulu selisih itu tidak terasa karena scrollbar menutupnya, sekarang
 * scrollbar-nya sengaja dimatikan (lihat .ppi-in di globals.css) sehingga huruf
 * turun seperti g/p/y bisa ikut terpotong. Karena itu tinggi border ikut
 * ditambahkan.
 */
function grow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  const border = el.offsetHeight - el.clientHeight;
  el.style.height = `${el.scrollHeight + border}px`;
}

/* --- Penyimpanan draft lokal (autosave seperti app lama) --- */
function subscribeDraft(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(DRAFT_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(DRAFT_EVENT, cb);
  };
}
function readDraft(): string | null {
  try {
    return localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
}
function writeDraft(value: string | null) {
  try {
    if (value === null) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, value);
    window.dispatchEvent(new Event(DRAFT_EVENT));
  } catch {
    /* penyimpanan penuh/dimatikan: abaikan, autosave hanya cadangan */
  }
}

type SavedDraft = {
  docType: DocType;
  customerName: string;
  customerPhone: string;
  issueDate: string;
  dueDate: string;
  payMethod: string;
  discountType: DiscountType;
  discountInput: string;
  taxRate: string;
  notes: string;
  termsText: string;
  dp: string;
  items: ItemState[];
  needsProduction?: boolean;
  prodDate?: string;
  prodTime?: string;
  savedAt: number;
};

function itemFilled(it: ItemState) {
  return Boolean(it.productName.trim() || it.description.trim() || it.basePrice);
}

export function InvoicePaperEditor({
  customers,
  settings,
  today,
  isOwner,
  initial,
  newDocType = "invoice",
  prefill,
  linkedOrder,
}: {
  customers: EditorCustomer[];
  settings: InvoiceSettings;
  today: string;
  isOwner: boolean;
  initial?: EditorInitial;
  newDocType?: DocType;
  /** Isi awal dari pekerjaan produksi ("Buat Invoice dari Pekerjaan Ini"). */
  prefill?: { customerName: string; customerPhone: string; items: { productName: string; qty: number; unit: string }[] };
  /** Pekerjaan produksi yang sudah tertaut (invoice dari pekerjaan, atau invoice yang sudah punya pekerjaan). */
  linkedOrder?: { id: number; code: string } | null;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const editingIssued = isEdit && initial?.status === "terbit";

  const [docType, setDocType] = useState<DocType>(initial?.docType ?? newDocType);
  const mode = docModeOf(docType);

  const [customerName, setCustomerName] = useState(initial?.customerName ?? prefill?.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(initial?.customerPhone ?? prefill?.customerPhone ?? "");
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? today);
  /* Jatuh tempo (Invoice) / Berlaku sampai (Estimasi) SENGAJA kosong
     di dokumen baru.

     Dulu isian ini diisi otomatis "tanggal dokumen + N hari" dari
     pengaturan. Masalahnya, angka itu bukan pilihan orang: begitu
     dokumen terbit, tanggal itu ikut tercetak di kertas, muncul di
     daftar, dipakai menghitung "terlambat N hari", dan bisa memicu
     pengingat ke pelanggan - semuanya atas nama yang tidak pernah
     memilihnya. Yang salah biasanya tidak ketahuan sampai tagihan
     telat dan pelanggan bilang tidak tahu soal tenggatnya.

     Sekarang kosong, jadi kalau memang ada termin, orang yang
     mengisi sendiri per dokumen. */
  const [dueDate, setDueDate] = useState(initial ? initial.dueDate : "");
  const [payMethod, setPayMethod] = useState(initial?.payMethod ?? "Transfer");
  const [discountType, setDiscountType] = useState<DiscountType>(initial?.discountType ?? "persen");
  const [discountInput, setDiscountInput] = useState(
    initial
      ? initial.discountType === "rp"
        ? thousands(String(Math.round(initial.discountInput)))
        : numText(initial.discountInput)
      : "",
  );
  const [taxRate, setTaxRate] = useState(initial ? numText(initial.taxRate) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [termsText, setTermsText] = useState((initial ? initial.terms : settings.defaultTerms).join("\n"));
  const [showTermsEdit, setShowTermsEdit] = useState(false);
  const [dp, setDp] = useState("");
  const [items, setItems] = useState<ItemState[]>(() =>
    initial?.items.length
      ? initial.items.map((it) => ({
          key: keyCounter++,
          lineKey: it.lineKey ?? newLineKey(),
          productName: it.productName,
          description: it.description,
          unit: it.unit,
          qty: numText(it.qty),
          areaM2: numText(it.areaM2),
          basePrice: it.basePrice ? thousands(String(it.basePrice)) : "",
          tiers: it.tiers,
          needsProduction: it.needsProduction ?? true,
          prodDueDate: it.prodDueDate ?? "",
          prodDueTime: it.prodDueTime ?? "",
        }))
      : prefill?.items.length
        ? prefill.items.map((it) => ({ ...blankItem(), productName: it.productName, qty: numText(it.qty), unit: it.unit }))
        : [blankItem()],
  );
  // Monitoring produksi (hanya Invoice yang belum punya pekerjaan).
  const [needsProduction, setNeedsProduction] = useState(initial?.needsProduction ?? false);
  const [prodDate, setProdDate] = useState(initial?.prodDueDate ?? "");
  const [prodTime, setProdTime] = useState(initial?.prodDueTime ?? "17:00");

  // Katalog produk: dimuat sekali (saat pertama dipakai), untuk saran nama produk & tombol Katalog.
  const [catalog, setCatalog] = useState<{ items: CatalogItem[]; categories: string[] } | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  /* Bahan SARAN produk: tanpa kartu induk, dan nama varian sudah digabung nama induknya ("Print HVS A4 Warna"),
     jadi mengetik "hvs warna" langsung menemukan varian dan yang masuk ke baris invoice adalah nama lengkapnya. */
  const suggestable = useMemo(() => leafItems(catalog?.items ?? []), [catalog]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [sug, setSug] = useState<{ key: number; idx: number } | null>(null);
  /* Dialog Set Harga untuk produk HARGA FLEKSIBEL yang dipilih lewat saran produk di baris. */
  const [flexSug, setFlexSug] = useState<{ key: number; item: CatalogItem } | null>(null);
  const [flashKey, setFlashKey] = useState<number | null>(null);
  const [calcKey, setCalcKey] = useState<number | null>(null);
  const [tierKey, setTierKey] = useState<number | null>(null);
  const [showCustomer, setShowCustomer] = useState(false);
  const [askPaid, setAskPaid] = useState(false);
  const [busy, setBusy] = useState<null | "draft" | "terbit" | "simpan">(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [bannerOff, setBannerOff] = useState(false);
  // Kode unik form ini: tombol tertekan dua kali / sinyal putus-nyambung tidak membuat dokumen dobel.
  const clientRef = useRef(uuid());
  const decidedRef = useRef(false);
  const wroteRef = useRef(false);

  /* ---------------- hitung ---------------- */
  const priced = useMemo(() => {
    const rows = items.map((it) =>
      computeRowPricing({
        qty: parseLooseNumber(it.qty),
        areaM2: parseLooseNumber(it.areaM2),
        basePrice: parseLooseNumber(it.basePrice),
        tiers: it.tiers,
      }),
    );
    const totals = computeInvoiceTotals(
      rows.map((r) => r.amount),
      mode.showTotals ? parseLooseNumber(discountInput) : 0,
      mode.showTotals ? parseLooseNumber(taxRate) : 0,
      discountType,
    );
    return { rows, totals };
  }, [items, discountInput, taxRate, discountType, mode.showTotals]);

  const { totals } = priced;
  const dpValue = Math.round(parseLooseNumber(dp));
  const filledItems = items.filter(itemFilled);
  const filledCount = filledItems.length;
  const productionCount = filledItems.filter((it) => it.needsProduction).length;
  const hasContent = Boolean(customerName.trim() || filledCount > 0);
  const payInfo = computePayInfo({
    total: totals.total,
    paid: editingIssued ? initial?.paidAmount ?? 0 : dpValue,
    method: payMethod,
    number: initial?.number ?? null,
    uniqueCodeEnabled: settings.uniqueCode,
  });

  /* ---------------- ukur ulang tinggi kolom teks ----------------
     Tinggi kolom Produk & Keterangan diukur sekali saat mount. Kalau
     font baru selesai dimuat atau lebar kolom berubah (jendela
     diperkecil/dibesar), jumlah baris bisa beda padahal isinya sama -
     kolomnya jadi terlalu pendek dan baris terakhir terpotong.
     Scrollbar sengaja disembunyikan, jadi ini wajib. */
  useEffect(() => {
    const regrow = () => {
      document.querySelectorAll<HTMLTextAreaElement>("#ppi-rows textarea.ppi-in").forEach((el) => grow(el));
    };
    regrow();
    // Font web (Geist) menggantikan font cadangan setelah halaman tampil.
    if (typeof document !== "undefined" && document.fonts?.ready) {
      void document.fonts.ready.then(regrow).catch(() => {});
    }
    window.addEventListener("resize", regrow);
    return () => window.removeEventListener("resize", regrow);
  }, [items]);

  /* ---------------- autosave & pulihkan ---------------- */
  const stored = useSyncExternalStore(subscribeDraft, readDraft, () => null);
  const restorable = useMemo(() => {
    if (isEdit || prefill || !stored) return null;
    try {
      const d = JSON.parse(stored) as SavedDraft;
      const filled = d.customerName?.trim() || d.items?.some(itemFilled);
      return filled ? d : null;
    } catch {
      return null;
    }
  }, [stored, isEdit, prefill]);

  useEffect(() => {
    if (isEdit || prefill) return;
    const timer = setTimeout(() => {
      if (!hasContent) return;
      // Jangan menimpa draft lama selagi pengguna belum memilih Pulihkan / Buang.
      if (readDraft() && !wroteRef.current && !decidedRef.current) return;
      const snapshot: SavedDraft = {
        docType, customerName, customerPhone, issueDate, dueDate, payMethod, discountType, discountInput,
        taxRate, notes, termsText, dp, items, needsProduction, prodDate, prodTime, savedAt: Date.now(),
      };
      writeDraft(JSON.stringify(snapshot));
      wroteRef.current = true;
      setBannerOff(true);
    }, 700);
    return () => clearTimeout(timer);
  }, [isEdit, prefill, hasContent, docType, customerName, customerPhone, issueDate, dueDate, payMethod, discountType, discountInput, taxRate, notes, termsText, dp, items, needsProduction, prodDate, prodTime]);

  function restoreDraft(d: SavedDraft) {
    decidedRef.current = true;
    setBannerOff(true);
    setDocType(d.docType);
    setCustomerName(d.customerName);
    setCustomerPhone(d.customerPhone);
    setIssueDate(d.issueDate);
    setDueDate(d.dueDate);
    setPayMethod(d.payMethod);
    setDiscountType(d.discountType);
    setDiscountInput(d.discountInput);
    setTaxRate(d.taxRate);
    setNotes(d.notes);
    setTermsText(d.termsText);
    setDp(d.dp);
    setNeedsProduction(Boolean(d.needsProduction));
    setProdDate(d.prodDate ?? "");
    setProdTime(d.prodTime ?? "17:00");
    setItems(
      d.items.length
        ? d.items.map((it) => ({
            ...blankItem(),
            ...it,
            key: keyCounter++,
            lineKey: it.lineKey || newLineKey(),
            needsProduction: it.needsProduction ?? true,
            prodDueDate: it.prodDueDate ?? "",
            prodDueTime: it.prodDueTime ?? "",
          }))
        : [blankItem()],
    );
  }
  function discardDraft() {
    decidedRef.current = true;
    setBannerOff(true);
    writeDraft(null);
  }

  /* ---------------- ubah state ---------------- */
  function patchItem(key: number, patch: Partial<ItemState>) {
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  /* ==================================================================
     PINDAH ANTAR SEL DENGAN PANAH KETIKBOARD
     ==================================================================
     Pengisi invoice sering mengetik baris demi baris sambil bergantian
     dengan tetikus. Tiap pindah dari kolom Qty ke kolom Harga berarti:
     tangan turun ke tetikus, klik, tangan naik lagi. Untuk satu invoice
     berisi sepuluh baris, itu puluhan gerakan yang seluruhnya bisa
     digantikan satu tombol.

     Aturannya SAMA DENGAN SPREADSHEET, dan itu bukan kebetulan:
     - Panah hanya dipindah-pakai kalau KURSOR SUDAH DI UJUNG ke arah
       itu. Kalau masih ada teks di sebelah kanan, panah tetap
       memindahkan kursor seperti biasa.
     - Tanpa itu, mengetik "25000" lalu menekan panah kanan akan
       melompati satu angka, dan panah atas/bawah di textarea yang
       sudah tumbuh jadi beberapa baris tidak akan pernah bisa dipakai.

     Peta sel: WADAH baris menandai diri dengan data-ppi-line, dan
     setiap isian dengan data-ppi-row + data-ppi-col.

     Kenapa dua nama berbeda dan bukan satu: versi pertama memakai
     data-ppi-row untuk baris DAN isian. Akibatnya
     el.closest("[data-ppi-row]") mengembalikan ISIAN-nya sendiri,
     bukan wadahnya - jadi baris.querySelectorAll("[data-ppi-col]")
     menghitung nol, dan syarat "sudah kolom terakhir" selalu terpenuhi.
     Hasilnya panah kiri dan kanan tidak pernah jalan sama sekali.
     Nama yang berbeda membuat mustahil tertukar.

     Peta ULONG lewat DOM, bukan larik React, supaya menambah atau
     menghapus baris tidak membuat indeks antar isian bergeser dan
     ikut salah.

     Kolom yang tidak ada di baris itu (mis. Harga saat mode tanpa
     harga) dilewati: fokus jatuh ke kolom terakhir yang ada, bukan
     ke tengah-tengah baris. */
  const barisRef = useRef<HTMLDivElement>(null);
  const fokusTertunda = useRef<{ row: number; col: number } | null>(null);

  /** Isian pada (baris, kolom). Kalau kolom tidak ada, ambil yang terakhir. */
  function selDi(row: number, col: number): HTMLElement | null {
    const akar = barisRef.current;
    if (!akar) return null;
    const baris = akar.querySelector<HTMLElement>('[data-ppi-line="' + row + '"]');
    if (!baris) return null;
    const semua = Array.from(baris.querySelectorAll<HTMLElement>("[data-ppi-col]"));
    if (!semua.length) return null;
    return semua[Math.min(col, semua.length - 1)] ?? null;
  }

  /** Pindahkan fokus ke sel dan letakkan kursor di ujungnya. */
  function fokusSel(row: number, col: number) {
    const el = selDi(row, col);
    if (!el) return;
    el.focus({ preventScroll: true });
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const n = el.value.length;
      try {
        el.setSelectionRange(n, n);
      } catch {
        /* sebagian input (mis. number) tidak punya selection - abaikan */
      }
    }
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /* Fokus yang diminta saat baris baru ditambahkan baru bisa diberikan
     setelah React selesai merender baris itu. Efeknya sengaja tanpa
     daftar dependensi supaya selalu dijalankan sesudah render - begitu
     ada permintaan tertunda, langsung dieksekusi. */
  useEffect(() => {
    const t = fokusTertunda.current;
    if (!t) return;
    fokusTertunda.current = null;
    fokusSel(t.row, t.col);
  });

  /** Panah bawah di baris terakhir = tambah baris, lalu ikut ke sel yang sama. */
  function tambahBarisLaluFokus(col: number) {
    const barisBaru = items.length;
    setItems((l) => [...l, blankItem()]);
    fokusTertunda.current = { row: barisBaru, col };
  }

  function onNavigasiSel(e: React.KeyboardEvent<HTMLDivElement>) {
    const el = e.target as HTMLElement;
    if (!el.hasAttribute?.("data-ppi-col")) return;
    // Modifier = perintah lain (pilih kata, pindah ke akhir baris, dsb).
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    const row = Number(el.getAttribute("data-ppi-row"));
    const col = Number(el.getAttribute("data-ppi-col"));
    if (!Number.isFinite(row) || !Number.isFinite(col)) return;

    /* Wadah baris dicari lewat data-ppi-line, BUKAN data-ppi-row.
       Isiannya sendiri juga punya data-ppi-row, jadi kalau yang dicari
       "[data-ppi-row]" closest() akan mengembalikan isian itu -
       bukan wadahnya - dan querySelectorAll("[data-ppi-col]") di
       dalamnya menghitung nol. Itu sebab panah kiri/kanan tidak
       pernah jalan di versi pertama. */
    const baris = el.closest<HTMLElement>("[data-ppi-line]");
    if (!baris) return;
    const jumlahKolom = baris.querySelectorAll("[data-ppi-col]").length;
    if (jumlahKolom === 0) return;

    // Posisi kursor. TEXTAREA dan INPUT punya selection; yang lain
    // tidak pernah jadi target, jadi aman dibaca.
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    const bisaPilih = typeof input.selectionStart === "number";
    const diAwal = bisaPilih ? input.selectionStart === 0 : false;
    const diAkhir = bisaPilih ? input.selectionStart === input.value.length : false;

    switch (e.key) {
      case "ArrowRight":
        if (!diAkhir || col + 1 >= jumlahKolom) return;
        e.preventDefault();
        fokusSel(row, col + 1);
        return;
      case "ArrowLeft":
        if (!diAwal || col === 0) return;
        e.preventDefault();
        fokusSel(row, col - 1);
        return;
      case "ArrowDown":
        if (!diAkhir) return;
        e.preventDefault();
        if (row + 1 < items.length) fokusSel(row + 1, col);
        else tambahBarisLaluFokus(col);
        return;
      case "ArrowUp":
        if (!diAwal) return;
        e.preventDefault();
        if (row > 0) fokusSel(row - 1, col);
        return;
      default:
        return;
    }
  }

  /**
   * Muat katalog produk.
   *
   * force=true dipakai saat jendela Katalog dibuka: daftar lama di dalam
   * editor bisa saja sudah basi (mis. owner baru saja menambah produk
   * di halaman Katalog, di tab lain). Tanpa muat ulang, produk yang BARU
   * ditambahkan itu tidak ada di daftar - jadi diketik pun tidak ketemu,
   * dan pemilik mengira pencariannya rusak. Daftar lama tetap tampil selama
   * pemuatan berjalan, jadi tidak ada kedip kosong.
   */
  async function loadCatalog(force = false) {
    if (!force && (catalog || catalogLoading)) return;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await fetch("/api/invoice-products");
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; data?: { products: CatalogItem[]; categories: string[] } };
      if (json.ok && json.data) setCatalog({ items: json.data.products, categories: json.data.categories });
      else setCatalogError(json.error ?? "Gagal memuat katalog.");
    } catch {
      setCatalogError("Koneksi terputus. Katalog belum bisa dimuat.");
    } finally {
      setCatalogLoading(false);
    }
  }

  /** Isi baris dari produk katalog (nama, keterangan, harga, harga bertingkat). */
  function fillRow(key: number, p: CatalogItem, overwrite: boolean) {
    setItems((list) =>
      list.map((it) =>
        it.key !== key
          ? it
          : {
              ...it,
              productName: p.name,
              description: overwrite || !it.description.trim() ? p.description ?? it.description : it.description,
              basePrice: mode.showPrices && p.price && (overwrite || !it.basePrice) ? thousands(String(p.price)) : it.basePrice,
              qty: overwrite && !it.qty.trim() ? "1" : it.qty,
              tiers: mode.showPrices ? p.tiers : null,
            },
      ),
    );
    setFlashKey(key);
    setTimeout(() => setFlashKey((k) => (k === key ? null : k)), 1600);
  }

  /** Tombol Katalog: pakai baris kosong terakhir bila ada (tidak menumpuk baris kosong), kalau tidak tambah baris baru. */
  function addFromCatalog(p: CatalogItem) {
    const last = items[items.length - 1];
    const lastEmpty = last && !last.productName.trim() && !last.description.trim() && !last.basePrice;
    if (lastEmpty) fillRow(last.key, p, true);
    else {
      const fresh = blankItem();
      setItems((l) => [...l, fresh]);
      // blankItem punya key baru; isi di render berikutnya agar state baris sudah ada
      setTimeout(() => fillRow(fresh.key, p, true), 0);
    }
  }

  function pickSuggestion(key: number, p: CatalogItem) {
    // Produk HARGA FLEKSIBEL lewat saran juga melewati dialog Set Harga: operator menetapkan harga dulu.
    if (!p.isGroup && p.pricingMode === "fleksibel") {
      setSug(null);
      setFlexSug({ key, item: p });
      return;
    }
    fillRow(key, p, false);
    setSug(null);
  }

  /** Hasil dialog Set Harga (produk fleksibel dipilih dari saran): nama lengkap + harga + catatan diterapkan ke baris yang sedang diisi. */
  function applyFlexSuggestion(key: number, p: CatalogItem, price: number, note: string | null) {
    setFlexSug(null);
    setItems((list) =>
      list.map((it) =>
        it.key !== key
          ? it
          : {
              ...it,
              productName: p.name,
              // Catatan dari dialog menggantikan keterangan; kalau kosong, pakai keterangan produk bila baris masih kosong.
              description: note ?? (it.description.trim() ? it.description : p.description ?? it.description),
              // Harga hasil dialog bersifat final untuk baris ini (harga yang tadinya diketik diganti).
              basePrice: mode.showPrices && price ? thousands(String(price)) : it.basePrice,
              tiers: mode.showPrices ? p.tiers : null,
            },
      ),
    );
    setFlashKey(key);
    setTimeout(() => setFlashKey((k) => (k === key ? null : k)), 1600);
  }

  function switchMode(next: DocType) {
    if (next === docType) return;
    if (hasContent && !confirm(`Ganti ke ${DOC_MODES[next].label}?\n\nIsi tabel dan customer tetap dipakai. Judul, nomor, dan kolom menyesuaikan jenis dokumen.`)) return;
    setDocType(next);
    // Hanya jenis tanpa label yang membuang isian. Jenis berlabel tidak
    // diisi apa pun di sini: yang sudah kosong tetap kosong, dan yang
    // sudah diisi orang tidak ditimpa.
    if (!DOC_MODES[next].dueLabel) setDueDate("");
    try {
      const url = new URL(window.location.href);
      if (next === "invoice") url.searchParams.delete("m");
      else url.searchParams.set("m", next);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* abaikan */
    }
  }

  function toggleDiscountType(next: DiscountType) {
    if (next === discountType) return;
    setDiscountType(next);
    setDiscountInput(""); // reset saat ganti mode (aturan app lama)
  }

  /* ---------------- simpan ---------------- */
  function buildPayload() {
    return {
      docType,
      customerName,
      customerPhone,
      issueDate,
      dueDate: mode.dueLabel ? dueDate || null : null,
      payMethod,
      discountType,
      discountValue: parseLooseNumber(discountInput),
      taxRate: parseLooseNumber(taxRate),
      notes,
      terms: termsText.split(/\r?\n/).map((t) => t.trim()).filter(Boolean),
      orderId: linkedOrder && !initial?.id ? linkedOrder.id : undefined,
      needsProduction: docType === "invoice" && !linkedOrder && !editingIssued && needsProduction,
      prodDueDate: needsProduction ? prodDate : undefined,
      prodDueTime: needsProduction ? prodTime : undefined,
      items: items.filter(itemFilled).map((it) => ({
        lineKey: it.lineKey,
        productName: it.productName,
        description: it.description,
        unit: it.unit || "pcs",
        qty: parseLooseNumber(it.qty),
        areaM2: parseLooseNumber(it.areaM2),
        basePrice: Math.round(parseLooseNumber(it.basePrice)),
        tiers: it.tiers,
        needsProduction: it.needsProduction,
        prodDueDate: it.needsProduction ? it.prodDueDate || null : null,
        prodDueTime: it.needsProduction && it.prodDueDate ? it.prodDueTime || null : null,
      })),
    };
  }

  async function call(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      code?: string;
      penjelasan?: string;
      data?: { invoice?: { id: number } };
    };
    return json;
  }

  function fail(json: { error?: string; code?: string; penjelasan?: string }) {
    setConflict(json.code === "VERSI_BERBEDA");
    setError(json.error ?? json.penjelasan ?? "Gagal menyimpan. Coba lagi sebentar lagi.");
  }

  /** Validasi + (kalau perlu) tanya "pembayaran sudah diterima?" lalu simpan. */
  function requestSubmit(kind: "draft" | "terbit" | "simpan") {
    setError(null);
    setConflict(false);
    // Data customer OPSIONAL - dokumen tetap bisa terbit tanpa nama.
    // Yang wajib tetap isi: minimal satu baris item.
    if (filledCount === 0) return setError("Isi minimal satu baris item.");
    if (kind === "terbit" && mode.showTotals && totals.total <= 0) return setError("Total masih Rp 0. Isi harga dulu sebelum menerbitkan.");
    if (docType === "invoice" && dpValue > totals.total) return setError("DP tidak boleh lebih besar dari total.");
    if (docType === "invoice" && needsProduction && !linkedOrder && !editingIssued) {
      if (!prodDate) return setError("Isi Deadline produksi utama dulu.");
      const productionItems = items.filter(itemFilled).filter((it) => it.needsProduction);
      if (!productionItems.length) {
        return setError("Centang minimal satu item yang perlu masuk antrian produksi, atau matikan monitoring produksi.");
      }
      const pastItem = productionItems.find((it) => it.prodDueDate && it.prodDueDate < today);
      if (pastItem) return setError(`Deadline item "${pastItem.productName || "tanpa nama"}" tidak boleh tanggal yang sudah lewat.`);
    }
    const needAsk =
      kind === "terbit" &&
      docType === "invoice" &&
      settings.askPaidOnSave &&
      totals.total >= settings.askPaidThreshold &&
      dpValue < totals.total;
    if (needAsk) return setAskPaid(true);
    void doSubmit(kind, dpValue);
  }

  async function doSubmit(kind: "draft" | "terbit" | "simpan", dpAmount: number) {
    setAskPaid(false);
    setBusy(kind);
    try {
      const payload = buildPayload();
      let id = initial?.id;
      const wantDp = kind === "terbit" && docType === "invoice" && dpAmount > 0;

      if (!isEdit) {
        const json = await call("/api/invoices", "POST", {
          ...payload,
          clientRef: clientRef.current,
          issue: kind === "terbit",
          dp: wantDp ? { amount: dpAmount, method: payMethod, kind: "dp", clientRef: `${clientRef.current}-dp` } : undefined,
        });
        if (!json.ok) return fail(json);
        id = json.data?.invoice?.id;
      } else {
        const json = await call(`/api/invoices/${initial!.id}`, "PATCH", { ...payload, version: initial!.version });
        if (!json.ok) return fail(json);
        if (kind === "terbit") {
          const issued = await call(`/api/invoices/${initial!.id}/issue`, "POST");
          if (!issued.ok) return fail(issued);
          if (wantDp) {
            const paid = await call(`/api/invoices/${initial!.id}/payments`, "POST", {
              amount: dpAmount, method: payMethod, kind: "dp", clientRef: `${clientRef.current}-dp`,
            });
            if (!paid.ok) return fail(paid);
          }
        }
      }
      if (!isEdit) writeDraft(null);
      router.push(`/invoice/${id}`);
      router.refresh();
    } catch {
      setError("Koneksi terputus. Cek internet lalu tekan tombolnya lagi. Aman, dokumen tidak akan tercatat dobel.");
    } finally {
      setBusy(null);
    }
  }

  /* ---------------- tampilan ---------------- */
  /* minmax(0, Nfr) - BUKAN "Nfr" polos. Tanpa minmax(0,..) trek kolom "aksi"
   (tombol hapus 28px + padding sel) memaksa treknya melebar dan seluruh
   kolom lain ikut bergeser, sehingga angka di baris tidak rata dengan
   judul kolomnya.

   Panjang label (produk 51px, keterangan 81px, m2 bahan 69px + slot 30px,
   qty 26px, harga satuan 94px + slot 30px, jumlah 50px, aksi 20px) + 20px
   padding sel dictates the fractions below, supaya semua judul kolom
   muat SATU BARIS di lebar desktop. Kolom jumlah diberi 11fr karena isinya
   "Rp 90.000" - kalau terlalu sempit nominal turun ke dua baris. */
const cols = mode.showPrices
    ? "minmax(0,22fr) minmax(0,18fr) minmax(0,15fr) minmax(0,6fr) minmax(0,18fr) minmax(0,11fr) minmax(0,7fr)"
    : "minmax(0,36fr) minmax(0,30fr) minmax(0,14fr) minmax(0,6fr) minmax(0,7fr)";
  const calcItem = items.find((i) => i.key === calcKey) ?? null;
  const tierItem = items.find((i) => i.key === tierKey) ?? null;
  const calcIndex = calcItem ? items.indexOf(calcItem) + 1 : 0;
  const addressLines = settings.address.split(/\r?\n/).filter(Boolean);
  const termsList = termsText.split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
  const draftLike = !editingIssued;
  const primaryLabel = editingIssued ? "Simpan Perubahan" : isEdit ? "Simpan & Terbitkan" : "Terbitkan";

  const sidebarActions = (
    <>
      {editingIssued ? (
        <SideButton icon={busy === "simpan" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} onClick={() => requestSubmit("simpan")} disabled={busy !== null}>
          Simpan Perubahan
        </SideButton>
      ) : (
        <>
          <SideButton icon={busy === "draft" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} onClick={() => requestSubmit("draft")} disabled={busy !== null}>
            Simpan Draft
          </SideButton>
          <SideButton icon={busy === "terbit" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} onClick={() => requestSubmit("terbit")} disabled={busy !== null}>
            {primaryLabel}
          </SideButton>
        </>
      )}
      {docType === "invoice" && draftLike && mode.showTotals ? (
        <SideButton
          icon={<BadgeCheck size={15} />}
          onClick={() => {
            if (totals.total <= 0) return setError("Isi harga dulu sebelum menandai lunas.");
            setDp(thousands(String(totals.total)));
          }}
          title="Isi DP sebesar total, lalu tekan Terbitkan"
        >
          Tandai Lunas
        </SideButton>
      ) : null}
      <SideButton icon={<ChevronRight size={15} />} href={isEdit ? `/invoice/${initial!.id}` : "/invoice"}>
        {isEdit ? "Batal edit" : "Batal"}
      </SideButton>
    </>
  );

  return (
    <InvoiceFrame
      sidebar={
        <InvoiceSidebar
          businessName={settings.businessName}
          isOwner={isOwner}
          docType={docType}
          modeBehavior={isEdit ? "fixed" : "switch"}
          onSwitchMode={switchMode}
          actions={sidebarActions}
        />
      }
    >
      <div className="space-y-3 pb-28 lg:pb-4">
        {restorable && !bannerOff ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900">
            <span>
              Ada isian yang belum disimpan ({restorable.customerName || "tanpa nama"}, {new Date(restorable.savedAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}).
            </span>
            <span className="flex gap-2">
              <button type="button" onClick={() => restoreDraft(restorable)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-white">Pulihkan</button>
              <button type="button" onClick={discardDraft} className="rounded-lg border border-amber-400 px-3 py-1.5">Buang</button>
            </span>
          </div>
        ) : null}

        {editingIssued ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            Dokumen ini sudah terbit. Mengubah isi akan menghitung ulang total dan status bayar. Nomor tetap {initial?.number}.
          </p>
        ) : null}

        {/* ppi-editing: penanda bahwa ini mode EDITOR, bukan kertas baca.
            Tanpa penanda ini, .ppi-in sengaja dibuat transparan supaya
            kertas terlihat bersih - tapi di editor itu membuat kolom
            isian tak terlihat sama sekali sampai diketuk. Aturan yang
            membuat isian terlihat hanya berlaku pada kelas ini, jadi
            halaman baca dan hasil cetak tetap bersih. */}
          <article className="ppi-paper ppi-editing px-5 pb-8 pt-8 sm:px-8">
          {/* ===== Kop =====
              ppi-brand + ppi-doc-title adalah jangkar untuk aturan
              "@media screen and (max-width: 639px)" di globals.css yang
              menyembunyikan kop + judul di layar HP supaya isiannya dibaca
              seperti formulir, bukan seperti lembar yang akan dicetak.
              Kelas yang sama sudah dipakai InvoicePaper (halaman baca).
              Karena aturannya diawali "screen and", saat CETAK dan saat PDF
              dirender media aktifnya "print" - blok itu tidak berlaku, jadi
              logo, nama, alamat, dan judul tetap ikut ke dokumen. */}
          <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="ppi-brand flex min-w-0 gap-3">
              <PaperLogo />
              <div className="min-w-0 space-y-0.5 text-xs text-slate-600">
                <p className="break-words text-lg font-extrabold text-slate-900"><AccentLastWord text={settings.businessName} /></p>
                {addressLines.length ? (
                  /* Sama seperti InvoicePaper: tiap baris alamat jadi baris
                     sendiri, bukan diringkas dengan join(", "). */
                  <p className="flex items-start gap-2">
                    <MapPin size={13} className="mt-0.5 shrink-0 text-[color:var(--ppi-accent)]" />
                    <span className="min-w-0">
                      {addressLines.map((line, i) => (
                        <span key={i} className="block break-words leading-relaxed">{line}</span>
                      ))}
                    </span>
                  </p>
                ) : null}
                {settings.email ? <p className="flex items-center gap-2"><Mail size={13} className="shrink-0 text-[color:var(--ppi-accent)]" /><span className="break-all">{settings.email}</span></p> : null}
                {settings.phone ? <p className="flex items-center gap-2"><MessageCircle size={13} className="shrink-0 text-[color:var(--ppi-accent)]" />{settings.phone}</p> : null}
                {isOwner && !addressLines.length && !settings.email && !settings.phone ? (
                  <Link href="/pengaturan/invoice" className="ppi-screen-only inline-block pt-1 text-[11px] font-bold text-[color:var(--ppi-accent)] underline">Isi alamat & kontak di Pengaturan</Link>
                ) : null}
              </div>
            </div>
            <div className="sm:w-[330px] sm:text-right">
              {/* Judul "INVOICE" disembunyikan di HP, tapi blok meta di
                  bawahnya (No. invoice, tanggal, jatuh tempo) TIDAK ikut
                  disembunyikan - itu isian, bukan hiasan dokumen. */}
              <p className="ppi-doc-title text-3xl font-black tracking-[0.12em] text-[color:var(--ppi-accent)] sm:text-4xl">{mode.title}</p>
              {/* Di HP seluruh blok ini jadi satu baris ketuk: tanggal
                  dokumen + jatuh tempo diringkas jadi satu nilai. Isinya
                  tetap berupa DateFieldID yang sama seperti sebelumnya,
                  jadi tidak ada aturan yang berubah. */}
              <EditRow
                icon={<CalendarDays size={16} />}
                label={mode.dueLabel ? "Tanggal & Tempo" : mode.dateLabel}
                value={
                  mode.dueLabel
                    ? `${formatDateID(issueDate)} → ${dueDate ? formatDateID(dueDate) : "(kosong)"}`
                    : formatDateID(issueDate)
                }
              >
                <div className="ppi-meta mt-3 text-xs">
                  <div className="ppi-meta-row">
                    <span className="ppi-meta-label">No. {mode.label.split(" ")[0]}</span>
                    <span className="ppi-in boxed ppi-num min-w-0 flex-1 !py-1.5 font-bold sm:max-w-[190px]">{initial?.number ?? "Otomatis saat terbit"}</span>
                  </div>
                  <div className="ppi-meta-row">
                    <span className="ppi-meta-label">{mode.dateLabel}</span>
                    <DateFieldID value={issueDate} onChange={setIssueDate} className="ppi-in boxed ppi-num min-w-0 flex-1 !py-1.5 !pr-8 font-bold sm:max-w-[190px]" />
                  </div>
                  {mode.dueLabel ? (
                    <div className="ppi-meta-row">
                      <span className="ppi-meta-label">{mode.dueLabel}</span>
                      <DateFieldID value={dueDate} onChange={setDueDate} className="ppi-in boxed ppi-num min-w-0 flex-1 !py-1.5 !pr-8 font-bold sm:max-w-[190px]" />
                    </div>
                  ) : null}
                </div>
              </EditRow>
            </div>
          </header>

          {/* ===== Item =====
              Di HP satu baris: ringkasan "N item · Rp X" plus tombol
              tambah. Ketuk barisnya untuk membuka daftar input ( autocomplete
              katalog, kalkulator m2, harga bertingkat, hapus baris ) - semuanya
              input yang sudah ada, tidak ada yang ditulis ulang.
              Barisnya terbuka otomatis kalau belum ada item, supaya
              pengguna tidak sempat bingung "di mana isi barang?". */}
          <EditRow
            icon={<ShoppingCart size={16} />}
            label="Item"
            value={
              filledCount > 0
                ? `${filledCount} item · ${mode.showTotals ? formatRupiah(totals.subtotal) : "tanpa total"}`
                : "Belum ada item - ketuk untuk menambah"
            }
            defaultOpen={filledCount === 0}
            aside={
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setItems((l) => [...l, blankItem()]); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setItems((l) => [...l, blankItem()]); }
                }}
                className="ppi-editrow-add"
              >
                <Plus size={16} />
              </span>
            }
          >
          <section className="mt-4">
            <div className="ppi-thead" style={{ "--ppi-cols": cols } as React.CSSProperties}>
              <span>Produk</span>
              <span>Keterangan</span>
              {/* Kalkulator m&sup2; TIDAK lagi ditaruh di header (diminta): tombolnya
                  sekarang ada di setiap baris, jadi teks kolom ini ikut menyisakan
                  ruang 30px lewat .ppi-head-slot supaya angka baris tetap rata. */}
              <span className="ppi-head-slot">M² Bahan</span>
              <span className="text-right">Qty</span>
              {mode.showPrices ? <span className="ppi-head-slot">Harga satuan</span> : null}
              {mode.showPrices ? <span className="text-right">Jumlah</span> : null}
              <span />
            </div>

            <div id="ppi-rows" ref={barisRef} onKeyDown={onNavigasiSel}>
              {items.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <ReceiptText size={34} className="mx-auto mb-2 opacity-60" />
                  <p className="text-sm font-bold text-slate-600">Belum ada item</p>
                  <p className="text-xs">Klik tombol di bawah untuk menambahkan item</p>
                </div>
              ) : null}

              {items.map((it, index) => {
                const row = priced.rows[index];
                return (
                  <div key={it.key} className={`ppi-rowwrap py-2 md:py-0 ${flashKey === it.key ? "ppi-flash" : ""}`}>
                    <div className="ppi-row" data-ppi-line={index} style={{ "--ppi-cols": cols } as React.CSSProperties}>
                      <label className="ppi-c-wide relative py-1.5">
                        <span className="ppi-mlabel">Produk #{index + 1}</span>
                        <textarea
                          ref={grow}
                          rows={1}
                          data-ppi-row={index}
                          data-ppi-col={0}
                          value={it.productName}
                          onChange={(e) => {
                            patchItem(it.key, { productName: e.target.value });
                            setSug({ key: it.key, idx: 0 });
                          }}
                          onFocus={() => void loadCatalog()}
                          onBlur={() => setTimeout(() => setSug((s2) => (s2 && s2.key === it.key ? null : s2)), 160)}
                          onKeyDown={(e) => {
                            const list = catalog && sug?.key === it.key ? matchCatalog(suggestable, it.productName) : [];
                            if (!list.length) return;
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              setSug({ key: it.key, idx: Math.min((sug?.idx ?? 0) + 1, list.length - 1) });
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              setSug({ key: it.key, idx: Math.max((sug?.idx ?? 0) - 1, 0) });
                            } else if (e.key === "Enter") {
                              e.preventDefault();
                              pickSuggestion(it.key, list[Math.min(sug?.idx ?? 0, list.length - 1)]);
                            } else if (e.key === "Escape") setSug(null);
                          }}
                          onInput={(e) => grow(e.currentTarget)}
                          spellCheck={false}
                          autoComplete="off"
                          className="ppi-in"
                          placeholder="Nama produk"
                        />
                        {catalog && sug?.key === it.key && it.productName.trim()
                          ? (() => {
                              const list = matchCatalog(suggestable, it.productName);
                              return list.length ? (
                                <ul className="ppi-screen-only absolute left-0 right-0 top-full z-30 mt-0.5 max-h-56 min-w-[230px] overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl" onMouseDown={(e) => e.preventDefault()}>
                                  {list.map((p, i) => (
                                    <li key={p.id}>
                                      <button type="button" onClick={() => pickSuggestion(it.key, p)} className={`block w-full px-3 py-1.5 text-left ${i === (sug?.idx ?? 0) ? "bg-teal-50" : "hover:bg-slate-50"}`}>
                                        <span className="block text-[12.5px] font-bold text-slate-800">{p.name}</span>
                                        <span className="block truncate text-[10.5px] text-slate-500">
                                          {[p.description, p.price ? formatRupiah(p.price) : "", p.tiers ? "bertingkat" : ""].filter(Boolean).join(" | ")}
                                        </span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : null;
                            })()
                          : null}
                      </label>
                      <label className="ppi-c-wide py-1.5">
                        <span className="ppi-mlabel">Keterangan</span>
                        <textarea
                          ref={grow}
                          rows={1}
                          data-ppi-row={index}
                          data-ppi-col={1}
                          value={it.description}
                          onChange={(e) => patchItem(it.key, { description: e.target.value })}
                          onInput={(e) => grow(e.currentTarget)}
                          spellCheck={false}
                          autoComplete="off"
                          className="ppi-in"
                          placeholder="Ukuran, finishing, dsb."
                        />
                      </label>
                      <label>
                        <span className="ppi-mlabel">M² bahan</span>
                        <span className="ppi-cell-slot">
                          <input
                            data-ppi-row={index}
                            data-ppi-col={2}
                            value={it.areaM2}
                            onChange={(e) => patchItem(it.key, { areaM2: e.target.value })}
                            inputMode="decimal"
                            className="ppi-in ppi-num"
                            placeholder="0"
                          />
                          <button type="button" className="ppi-icon-btn" title="Kalkulator m²: hitung luas dari panjang & lebar" aria-label={`Kalkulator m² baris ${index + 1}`} onClick={() => setCalcKey(it.key)}>
                            <Calculator size={12} />
                          </button>
                        </span>
                      </label>
                      <label>
                        <span className="ppi-mlabel">Qty</span>
                        <input
                          data-ppi-row={index}
                          data-ppi-col={3}
                          value={it.qty}
                          onChange={(e) => patchItem(it.key, { qty: e.target.value })}
                          inputMode="decimal"
                          className="ppi-in ppi-num"
                          placeholder="1"
                        />
                      </label>
                      {mode.showPrices ? (
                        <>
                          <label>
                            <span className="ppi-mlabel">Harga satuan</span>
                            <span className="ppi-cell-slot">
                              <input
                                data-ppi-row={index}
                                data-ppi-col={4}
                                value={it.basePrice}
                                onChange={(e) => patchItem(it.key, { basePrice: thousands(e.target.value) })}
                                inputMode="numeric"
                                className="ppi-in ppi-num"
                                placeholder="0"
                              />
                              <button
                                type="button"
                                className={`ppi-icon-btn ${it.tiers ? "on" : ""}`}
                                title={it.tiers ? `Harga bertingkat aktif (${it.tiers.list.length} tier)` : "Harga bertingkat"}
                                aria-label={`Harga bertingkat baris ${index + 1}`}
                                onClick={() => setTierKey(it.key)}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 20V14M12 20V8M19 20V4" /></svg>
                              </button>
                            </span>
                            {row && row.hasTier && row.qty > 0 ? <span className="mt-0.5 block text-right text-[10px] font-semibold text-teal-700">{row.label}</span> : null}
                          </label>
                          {/* ppi-amount: isinya teks biasa, bukan isian, jadi
                              tingginya hanya 20px sedangkan lima kolom lain
                              32.2px. Kelas ini membuat teksnya duduk di tengah
                              kotak setinggi isian - see .ppi-amount di
                              globals.css. Tanpa itu kolom Jumlah terlihat
                              melorot ke bawah. */}
                          <div className="ppi-amount flex items-center justify-between gap-2 md:justify-end">
                            <span className="ppi-mlabel">Jumlah</span>
                            <span className="text-sm font-extrabold text-slate-900">{formatRupiah(row?.amount ?? 0)}</span>
                          </div>
                        </>
                      ) : null}
                      <div className="ppi-c-wide ppi-row-rm flex justify-end">
                        <button
                          type="button"
                          onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 dark:text-rose-400"
                          aria-label={`Hapus baris ${index + 1}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    {docType === "invoice" && needsProduction && !linkedOrder && !editingIssued && itemFilled(it) ? (
                      <div className="ppi-screen-only mx-0 mb-1 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-dashed border-teal-200 bg-teal-50/40 px-2.5 py-1.5 dark:border-teal-400/25 dark:bg-teal-400/5">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-teal-800 dark:text-teal-200">
                          <input
                            type="checkbox"
                            checked={it.needsProduction}
                            onChange={(e) => patchItem(it.key, { needsProduction: e.target.checked })}
                            className="h-3.5 w-3.5 accent-teal-600"
                          />
                          Perlu produksi
                        </label>
                        {it.needsProduction ? (
                          <>
                            <label className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-600 dark:text-slate-300">
                              Deadline item
                              <DateFieldID
                                value={it.prodDueDate}
                                onChange={(v) => patchItem(it.key, { prodDueDate: v })}
                                min={today}
                                className="ppi-in boxed !w-[8.5rem] !py-1 !text-[11px]"
                              />
                            </label>
                            <label className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-600 dark:text-slate-300">
                              Jam
                              <TimeFieldID
                                value={it.prodDueTime}
                                onChange={(v) => patchItem(it.key, { prodDueTime: v })}
                                disabled={!it.prodDueDate}
                                className="ppi-in boxed !w-[5.5rem] !py-1 !text-[11px] disabled:opacity-50"
                              />
                            </label>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              Kosong = ikut deadline utama
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            Tidak masuk antrian produksi
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Bilah bawah tabel item.
                HP: dua tombol sama lebar dan sama tinggi dalam satu baris, lalu
                baris ringkasan (jumlah item kiri, subtotal kanan) di bawahnya.
                Layar lebar (sm ke atas): satu baris - tombol di kiri, ringkasan
                di kanan. Sebelumnya tombol bertumpuk dengan lebar berbeda dan
                ringkasan melayang di tengah-kanan sehingga tampak berantakan. */}
            <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <button type="button" onClick={() => setItems((l) => [...l, blankItem()])} className="ppi-dashed-btn !min-h-10 !w-full !rounded-xl !px-4 sm:!w-auto">
                  <Plus size={14} /> Tambah Baris
                </button>
                <button type="button" onClick={() => { setShowPicker(true); void loadCatalog(true); }} className="ppi-screen-only inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[color:var(--ppi-panel-line)] bg-transparent px-4 py-2 text-xs font-bold text-[color:var(--ppi-accent)] hover:bg-[color:var(--ppi-accent-tint)] sm:w-auto">
                  <Package size={14} /> Katalog
                </button>
              </span>
              <span className="flex items-baseline justify-between gap-4 sm:justify-end">
                <span className="text-xs text-slate-500">{filledCount} item</span>
                {mode.showTotals ? <span className="text-base font-extrabold text-slate-900">{formatRupiah(totals.subtotal)}</span> : null}
              </span>
            </div>
          </section>
          </EditRow>

          {/* ===== Data customer =====

              Kotak di bawah ini adalah TOMBOL, bukan tampilan.

              Semula isinya <div> biasa, dan satu-satunya cara membuka
              jendela ubah customer adalah pensil kecil di kolom "aside"
              milik EditRow. Masalahnya, kepala EditRow disembunyikan di
              lg ke atas (lihat .ppi-editrow-head di globals.css) - jadi di
              desktop pensil itu tidak ada, dan kotaknya tidak punya satu
              pun elemen yang bisa diklik. Di layar lebar mengetuk "Data
              Customer" tidak melakukan apa-apa, padahal tampilannya jelas
              mengajak diketuk: kotak putus-putus, teks "Klik untuk diisi
              bila perlu", dan ikon pensil di kanan.

              Sekarang kotaknya sendiri yang jadi tombol, jadi cara mengetuk
              hanya satu di semua lebar layar dan tidak bergantung pada
              bagian EditRow yang kebetulan tampil atau tidak.

              type="button" wajib: elemen ini ada di dalam <form> invoice,
              tanpa itu setiap ketukan ikut mengirim form.

              Ikon pensil di dalam kotak diberi aria-hidden karena hanya
              hiasan - sudah tercakup di aria-label tombolnya. */}
          <EditRow
            icon={<User size={16} />}
            label="Customer"
            value={customerName ? `${customerName}${customerPhone ? ` · ${customerPhone}` : ""}` : "Tidak diisi (opsional)"}
            aside={
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setShowCustomer(true); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setShowCustomer(true); }
                }}
                className="ppi-editrow-add"
              >
                <Pencil size={15} />
              </span>
            }
          >
          <button
            type="button"
            onClick={() => setShowCustomer(true)}
            aria-label={customerName ? `Ubah data customer ${customerName}` : "Isi data customer"}
            className="ppi-dashed ppi-screen-only mt-3 flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <User size={18} className="shrink-0 text-[color:var(--ppi-accent)]" />
            <span className="min-w-0 flex-1">
              <span className="ppi-kicker">Data Customer</span>
              <span className={`block truncate text-sm font-bold ${customerName ? "text-slate-800" : "text-slate-500"}`}>
                {customerName ? `${customerName}${customerPhone ? ` · ${customerPhone}` : ""}` : "Tidak diisi (opsional)"}
              </span>
              <span className="block text-[10.5px] text-slate-500">
                {customerName
                  ? settings.showCustomerOnPrint
                    ? "Ikut tercetak di lembar dokumen."
                    : "Tidak ikut tercetak (bisa diubah di Pengaturan > Dokumen)."
                  : "Boleh dikosongkan. Klik untuk diisi bila perlu."}
              </span>
            </span>
            <Pencil size={16} aria-hidden className="shrink-0 text-[color:var(--ppi-accent)]" />
          </button>
          {settings.showCustomerOnPrint && customerName ? (
            <div className="mt-3 text-xs text-slate-600">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Kepada</p>
              <p className="flex items-center gap-1.5 font-bold text-slate-900"><UserRound size={12} /> {customerName}</p>
              {customerPhone ? <p>{customerPhone}</p> : null}
            </div>
          ) : null}
          </EditRow>

          {/* ===== Monitoring produksi (hanya Invoice) ===== */}
          {docType === "invoice" ? (
            linkedOrder ? (
              <p className="ppi-screen-only mt-3 flex items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50/60 px-3 py-2 text-xs font-semibold text-teal-800">
                <Factory size={14} className="shrink-0" />
                <span>Tertaut ke pekerjaan produksi <Link href={`/pesanan/${linkedOrder.id}`} className="font-bold underline">{linkedOrder.code}</Link>. Harga dan pembayaran di pekerjaan ikut invoice ini.</span>
              </p>
            ) : editingIssued ? null : (
              /* Sakelarnya yang membuka panel isian, bukan chevron.

                 Dulu baris ini memakai EditRow biasa: chevron di kanan
                 membuka isinya, dan sakelarnya men-toggle "Perlu
                 monitoring produksi" - jadi ada DUA langkah untuk
                 sampai ke kolom deadline, dan panel isiannya sudah
                 tampil padahal monitoring masih mati.

                 Sekarang baris ini dikendalikan dari luar
                 (open={needsProduction}): chevron-nya dihilangkan,
                 kepala barisnya bukan tombol, dan panel isian
                 mengikuti sakelar - sakelar dinyalakan, panelnya
                 langsung terbuka; dimatikan, panelnya langsung
                 tertutup. Tidak ada langkah tambahan.

                 Sakelar di dalam panel disembunyikan di HP
                 (hidden lg:inline-block) karena di HP sakelar baris
                 ini ada tepat di atasnya - dua sakelar untuk hal yang
                 sama hanya membingungkan. Di desktop kepala baris
                 disembunyikan (aturan .ppi-editrow-head), jadi
                 sakelar di dalam panel tetap dipakai di sana. */
              <EditRow
                icon={<Factory size={16} />}
                label="Monitoring Produksi"
                value={needsProduction ? "Ikut masuk antrian produksi" : "Transaksi langsung (invoice saja)"}
                aside={
                  <span onClick={(e) => e.stopPropagation()} className="flex items-center">
                    <ToggleSwitch
                      checked={needsProduction}
                      onChange={setNeedsProduction}
                      label="Perlu monitoring produksi"
                    />
                  </span>
                }
                open={needsProduction}
              >
              <div className="ppi-screen-only mt-3 rounded-2xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800"><Factory size={14} className="text-teal-600" /> Perlu monitoring produksi</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Saat invoice diterbitkan, hanya item yang dicentang &ldquo;Perlu produksi&rdquo; di bawah yang masuk antrian PrintFlow. Item lain tetap ditagih, tapi tidak dipantau produksinya.
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={needsProduction}
                    onChange={setNeedsProduction}
                    label="Perlu monitoring produksi"
                    className="mt-0.5 hidden lg:inline-block"
                  />
                </div>
                {needsProduction ? (
                  <>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <label className="block">
                        <span className="ppi-label">Deadline utama *</span>
                        <DateFieldID value={prodDate} onChange={setProdDate} className="ppi-in boxed" />
                      </label>
                      <label className="block">
                        <span className="ppi-label">Jam deadline utama</span>
                        {/* Dulu <input type="time"> polos: yang muncul saat
                            diketuk adalah panel jam milik sistem operasi, satu-
                            satunya popup di aplikasi ini yang tidak seragam -
                            warnanya tidak ikut tema dan gayanya tidak bisa
                            diatur. Sekarang memakai TimeFieldID yang sama
                            dengan panel milik aplikasi, berpasangan dengan
                            kalender di sebelahnya. */}
                        <TimeFieldID value={prodTime} onChange={setProdTime} className="ppi-in boxed" />
                      </label>
                    </div>
                    <p className="mt-1.5 text-[10.5px] text-slate-400">
                      Deadline item yang dikosongkan otomatis memakai deadline utama ini.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/[0.04]">
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        <b className="font-extrabold text-teal-700 dark:text-teal-300">{productionCount}</b> dari {filledCount} item masuk antrian produksi.
                      </p>
                      <span className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setItems((list) => list.map((it) => ({ ...it, needsProduction: true })))}
                          className="rounded-lg px-2 py-1 text-[10.5px] font-bold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-white/5"
                        >
                          Pilih semua
                        </button>
                        <button
                          type="button"
                          onClick={() => setItems((list) => list.map((it) => ({ ...it, needsProduction: false })))}
                          className="rounded-lg px-2 py-1 text-[10.5px] font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
                        >
                          Kosongkan
                        </button>
                      </span>
                    </div>
                  </>
                ) : null}
              </div>
              </EditRow>
            )
          ) : null}

          {/* ===== Pembayaran + total =====
              Di HP tiap kelompok jadi satu baris ketuk (EditRow): nilai
              sekarang tetap terlihat tanpa harus dibuka dulu. Di layar
              lebar semuanya terbuka seperti sebelumnya. */}
          {mode.showTotals ? (
            <section className={`mt-6 grid items-start gap-4 ${mode.hasPayments ? "md:grid-cols-2" : ""}`}>
              {mode.hasPayments ? (
                <InvoicePayPanel
                  info={payInfo}
                  settings={settings}
                  isOwner={isOwner}
                  methodSlot={
                    <EditRow
                      icon={<CreditCard size={16} />}
                      label="Metode Pembayaran"
                      value={payMethod}
                      defaultOpen
                    >
                      <div className="ppi-panel">
                        <span className="ppi-kicker">Metode Pembayaran</span>
                        <span className="relative mt-2 block">
                          <CreditCard size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ppi-accent)]" />
                          {/* Pakai Select milik aplikasi, bukan <select> bawaan browser:
                              panel daftarnya digambar sendiri (tema ikut) dan chevron-nya
                              cuma satu - <select> asli sudah punya panah sendiri, jadi dua-duanya
                              sempat tampil bareng (panah ganda). */}
                          <Select
                            value={payMethod}
                            onChange={(e) => setPayMethod(e.target.value)}
                            className="ppi-in boxed !py-2.5 !pl-9 font-bold"
                            aria-label="Metode pembayaran"
                          >
                            {PAY_METHODS.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </Select>
                        </span>
                      </div>
                    </EditRow>
                  }
                />
              ) : null}

              <div className={mode.hasPayments ? "" : "md:ml-auto md:w-[380px]"}>
                <EditRow
                  icon={<Calculator size={16} />}
                  label="Rincian Biaya"
                  value={`${formatRupiah(totals.total)} total`}
                  defaultOpen
                >
                  <div className="ppi-panel space-y-2.5 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-slate-600">Subtotal <span className="text-[10.5px] text-slate-400">(Sebelum Diskon &amp; Pajak)</span></span>
                      <b>{formatRupiah(totals.subtotal)}</b>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700">Diskon</span>
                      <span className="flex items-center gap-1.5">
                        <input
                          value={discountInput}
                          onChange={(e) => setDiscountInput(discountType === "rp" ? thousands(e.target.value) : e.target.value)}
                          inputMode="decimal"
                          placeholder={discountType === "rp" ? "0" : "0"}
                          className="ppi-in boxed ppi-num !w-20 !py-1.5"
                          aria-label="Nilai diskon"
                        />
                        <span className="ppi-seg">
                          <button type="button" className={discountType === "persen" ? "on" : ""} onClick={() => toggleDiscountType("persen")}>%</button>
                          <button type="button" className={discountType === "rp" ? "on" : ""} onClick={() => toggleDiscountType("rp")}>Rp</button>
                        </span>
                        <span className="w-11 text-xs text-slate-500">%</span>
                        <span className="w-24 text-right text-xs font-bold text-slate-700">{totals.discountAmount > 0 ? `- ${formatRupiah(totals.discountAmount)}` : "Rp 0"}</span>
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700">PPN <span className="text-[10.5px] font-normal text-slate-400">(Pajak)</span></span>
                      <span className="flex items-center gap-1.5">
                        <input value={taxRate} onChange={(e) => setTaxRate(e.target.value)} inputMode="decimal" placeholder="0" className="ppi-in boxed ppi-num !w-16 !py-1.5" aria-label="Persen pajak" />
                        <span className="text-xs text-slate-500">%</span>
                        <span className="w-24 text-right text-xs font-bold text-slate-700">{formatRupiah(totals.taxAmount)}</span>
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2 border-t border-slate-200 pt-3">
                      <span className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--ppi-accent)]">Total Akhir</span>
                      <span className="text-xl font-black text-slate-900">{formatRupiah(totals.total)}</span>
                    </div>
                    {docType === "invoice" && !editingIssued ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-700">DP</span>
                        <input value={dp} onChange={(e) => setDp(thousands(e.target.value))} inputMode="numeric" placeholder="0" className="ppi-in boxed ppi-num !w-36 !py-1.5" aria-label="Nominal DP" />
                      </div>
                    ) : null}
                  </div>
                  {docType === "invoice" && !editingIssued ? (
                    <p className="mt-2 text-[10.5px] text-slate-400">DP dicatat sebagai pembayaran pertama saat Terbitkan. Cicilan berikutnya lewat Catat Pembayaran.</p>
                  ) : null}
                {docType === "invoice" ? (
                  editingIssued ? (
                    <Link href={`/invoice/${initial!.id}#pembayaran`} className="ppi-dashed-btn ppi-screen-only mt-3">
                      <Banknote size={14} /> Catat Pembayaran
                    </Link>
                  ) : (
                    <p className="ppi-dashed-btn ppi-screen-only mt-3" aria-disabled="true">
                      <Banknote size={14} /> Catat Pembayaran (setelah diterbitkan)
                    </p>
                  )
                ) : null}
                </EditRow>
              </div>
            </section>
          ) : (
            <section className="mt-8 grid grid-cols-2 gap-6 text-center text-xs text-slate-700">
              <div><p>Pengirim,</p><div className="h-16" /><p className="border-t border-slate-400 pt-1 font-bold">{settings.businessName}</p></div>
              <div><p>Diterima oleh,</p><div className="h-16" /><p className="border-t border-slate-400 pt-1 font-bold">(nama &amp; tanda tangan)</p></div>
            </section>
          )}

          <InvoiceSignature settings={settings} />

          {/* ===== Syarat & ketentuan =====
              Di HP jadi baris: ringkasan jumlah syarat, dan tombol "Ubah"
              seperti sebelumnya. Isinya persis sama seperti sebelumnya. */}
          <EditRow
            icon={<ScrollText size={16} />}
            label="Syarat & Ketentuan"
            value={termsList.length ? `${termsList.length} butir${notes ? " · ada catatan" : ""}` : "Belum ada syarat"}
            defaultOpen
            aside={
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setShowTermsEdit((v) => !v); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setShowTermsEdit((v) => !v); }
                }}
                className="ppi-editrow-text"
              >
                {showTermsEdit ? "Selesai" : "Ubah"}
              </span>
            }
          >
          <section className="ppi-panel mt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="ppi-kicker">Syarat & Ketentuan</p>
              <button type="button" onClick={() => setShowTermsEdit((v) => !v)} className="ppi-screen-only text-[11px] font-bold text-[color:var(--ppi-accent)] underline">
                {showTermsEdit ? "Selesai" : "Ubah"}
              </button>
            </div>
            {showTermsEdit ? (
              <div className="mt-3 space-y-2">
                <textarea value={termsText} onChange={(e) => setTermsText(e.target.value)} rows={4} className="ppi-in boxed" placeholder="Satu syarat per baris" />
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="ppi-in boxed" placeholder="Catatan tambahan untuk pelanggan (opsional)" />
              </div>
            ) : (
              <>
                <ul className="mt-3">
                  {termsList.map((t, i) => (
                    <li key={i} className="ppi-term"><CircleCheck size={15} strokeWidth={2.2} />{t}</li>
                  ))}
                  {termsList.length === 0 ? <li className="text-[11px] text-slate-400">Belum ada syarat.</li> : null}
                </ul>
                {notes ? <p className="mt-3 whitespace-pre-line text-[11px] text-slate-500">Catatan: {notes}</p> : null}
              </>
            )}
          </section>
          </EditRow>
        </article>

        {error ? (
          <div className="flex items-start gap-2 break-words rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p>{error}</p>
              {conflict ? (
                <button type="button" onClick={() => window.location.reload()} className="btn-secondary mt-2 px-3 py-1.5 text-xs">Muat ulang halaman</button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* ===== Bar bawah (HP) ===== */}
      <div className="fixed inset-x-0 bottom-20 z-30 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(0,0,0,.12)] backdrop-blur md:bottom-0 lg:hidden dark:border-slate-700 dark:bg-[#0b1c28]/95">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          {mode.showTotals ? (
            <p className="min-w-0 flex-1 text-xs text-slate-500">Total <b className="block truncate text-sm text-[color:var(--pf-ink)]">{formatRupiah(totals.total)}</b></p>
          ) : (
            <p className="min-w-0 flex-1 text-xs text-slate-500">{filledCount} item</p>
          )}
          {editingIssued ? (
            <button type="button" disabled={busy !== null} onClick={() => requestSubmit("simpan")} className="btn-primary">
              {busy === "simpan" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan
            </button>
          ) : (
            <>
              <button type="button" disabled={busy !== null} onClick={() => requestSubmit("draft")} className="btn-secondary">
                {busy === "draft" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Draft
              </button>
              <button type="button" disabled={busy !== null} onClick={() => requestSubmit("terbit")} className="btn-primary">
                {busy === "terbit" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {isEdit ? "Terbitkan" : "Terbitkan"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ===== Jendela-jendela ===== */}
      {calcItem ? (
        <M2CalcModal
          rowLabel={`baris ${calcIndex}${calcItem.productName ? ` · ${calcItem.productName}` : ""}`}
          onClose={() => setCalcKey(null)}
          onApply={(m2) => {
            patchItem(calcItem.key, { areaM2: fmtDec(m2, 4) });
            setCalcKey(null);
          }}
        />
      ) : null}
      {tierItem ? (
        <TierModal
          initial={tierItem.tiers}
          basePrice={parseLooseNumber(tierItem.basePrice)}
          areaM2={parseLooseNumber(tierItem.areaM2)}
          qty={parseLooseNumber(tierItem.qty)}
          onClose={() => setTierKey(null)}
          onClear={() => {
            patchItem(tierItem.key, { tiers: null });
            setTierKey(null);
          }}
          onSave={(cfg) => {
            patchItem(tierItem.key, { tiers: cfg });
            setTierKey(null);
          }}
        />
      ) : null}
      {showCustomer ? (
        <CustomerModal
          customers={customers}
          name={customerName}
          phone={customerPhone}
          onClose={() => setShowCustomer(false)}
          onSave={(n, p) => {
            setCustomerName(n);
            setCustomerPhone(p);
            setShowCustomer(false);
          }}
        />
      ) : null}
      {showPicker ? (
        <CatalogPicker
          items={catalog?.items ?? []}
          categories={catalog?.categories ?? []}
          loading={catalogLoading && !catalog}
          error={catalogError}
          onPick={addFromCatalog}
          onClose={() => setShowPicker(false)}
          isOwner={isOwner}
        />
      ) : null}
      {flexSug ? (
        <CatalogSetPriceDialog
          productId={flexSug.item.id}
          name={flexSug.item.name}
          baseDescription={flexSug.item.description}
          presets={flexSug.item.pricePresets ?? []}
          onClose={() => setFlexSug(null)}
          onConfirm={(price, note) => applyFlexSuggestion(flexSug.key, flexSug.item, price, note)}
        />
      ) : null}
      {askPaid ? (
        <AskPaidModal
          total={totals.total}
          onClose={() => setAskPaid(false)}
          onFull={() => void doSubmit("terbit", totals.total)}
          onLater={() => void doSubmit("terbit", dpValue)}
        />
      ) : null}
    </InvoiceFrame>
  );
}
