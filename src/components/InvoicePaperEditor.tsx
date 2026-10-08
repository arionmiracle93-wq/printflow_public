"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Factory,
  Calculator,
  Check,
  ChevronRight,
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
} from "lucide-react";
import { DateFieldID } from "@/components/DateFieldID";
import { AskPaidModal, CustomerModal, M2CalcModal, TierModal, fmtDec } from "@/components/InvoiceEditorModals";
import { PaperLogo } from "@/components/PaperLogo";
import { InvoicePayPanel } from "@/components/InvoicePayPanel";
import { InvoiceSignature } from "@/components/InvoiceSignature";
import { InvoiceFrame, InvoiceSidebar, SideButton } from "@/components/InvoiceSidebar";
import { formatRupiah } from "@/lib/domain";
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
    productName: string;
    description: string;
    unit: string;
    qty: number;
    areaM2: number;
    basePrice: number;
    tiers: TierConfig | null;
  }[];
};

type ItemState = {
  key: number;
  productName: string;
  description: string;
  unit: string;
  qty: string;
  areaM2: string;
  basePrice: string;
  tiers: TierConfig | null;
};

const DRAFT_KEY = "pf_invoice_draft_v1";
const DRAFT_EVENT = "pf-invoice-draft";

let keyCounter = 1;

function blankItem(): ItemState {
  return { key: keyCounter++, productName: "", description: "", unit: "pcs", qty: "1", areaM2: "", basePrice: "", tiers: null };
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

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days)).toISOString().slice(0, 10);
}

function grow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
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
  const [dueDate, setDueDate] = useState(
    initial ? initial.dueDate : settings.dueDays > 0 ? addDays(today, settings.dueDays) : "",
  );
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
          productName: it.productName,
          description: it.description,
          unit: it.unit,
          qty: numText(it.qty),
          areaM2: numText(it.areaM2),
          basePrice: it.basePrice ? thousands(String(it.basePrice)) : "",
          tiers: it.tiers,
        }))
      : prefill?.items.length
        ? prefill.items.map((it) => ({ ...blankItem(), productName: it.productName, qty: numText(it.qty), unit: it.unit }))
        : [blankItem()],
  );
  // Monitoring produksi (hanya Invoice yang belum punya pekerjaan).
  const [needsProduction, setNeedsProduction] = useState(initial?.needsProduction ?? false);
  const [prodDate, setProdDate] = useState(initial?.prodDueDate ?? "");
  const [prodTime, setProdTime] = useState(initial?.prodDueTime ?? "17:00");

  const [calcKey, setCalcKey] = useState<number | null>(null);
  const [tierKey, setTierKey] = useState<number | null>(null);
  const [lastM2Key, setLastM2Key] = useState<number | null>(null);
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

  const customerNames = useMemo(() => customers.map((c) => c.name), [customers]);
  const phoneByName = useMemo(() => {
    const map: Record<string, string> = {};
    customers.forEach((c) => {
      if (c.phone) map[c.name.toLowerCase()] = c.phone;
    });
    return map;
  }, [customers]);

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
  const filledCount = items.filter(itemFilled).length;
  const hasContent = Boolean(customerName.trim() || filledCount > 0);
  const payInfo = computePayInfo({
    total: totals.total,
    paid: editingIssued ? initial?.paidAmount ?? 0 : dpValue,
    method: payMethod,
    number: initial?.number ?? null,
    uniqueCodeEnabled: settings.uniqueCode,
  });

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
    setItems(d.items.length ? d.items.map((it) => ({ ...it, key: keyCounter++ })) : [blankItem()]);
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

  function switchMode(next: DocType) {
    if (next === docType) return;
    if (hasContent && !confirm(`Ganti ke ${DOC_MODES[next].label}?\n\nIsi tabel dan customer tetap dipakai. Judul, nomor, dan kolom menyesuaikan jenis dokumen.`)) return;
    setDocType(next);
    if (!DOC_MODES[next].dueLabel) setDueDate("");
    else if (!dueDate && settings.dueDays > 0) setDueDate(addDays(issueDate || today, settings.dueDays));
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
        productName: it.productName,
        description: it.description,
        unit: it.unit || "pcs",
        qty: parseLooseNumber(it.qty),
        areaM2: parseLooseNumber(it.areaM2),
        basePrice: Math.round(parseLooseNumber(it.basePrice)),
        tiers: it.tiers,
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
    if (!customerName.trim()) return setError("Isi Data Customer dulu: klik bar \"Data Customer\" di bawah tabel.");
    if (filledCount === 0) return setError("Isi minimal satu baris item.");
    if (kind === "terbit" && mode.showTotals && totals.total <= 0) return setError("Total masih Rp 0. Isi harga dulu sebelum menerbitkan.");
    if (docType === "invoice" && dpValue > totals.total) return setError("DP tidak boleh lebih besar dari total.");
    if (docType === "invoice" && needsProduction && !linkedOrder && !editingIssued && !prodDate) {
      return setError("Isi Deadline produksi dulu (satu-satunya isian tambahan untuk monitoring produksi).");
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
  const cols = mode.showPrices ? "24fr 22fr 13fr 8fr 15fr 14fr 4fr" : "38fr 34fr 14fr 10fr 4fr";
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

        <article className="ppi-paper px-4 pb-6 pt-8 sm:px-8">
          {/* ===== Kop ===== */}
          <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <PaperLogo />
              <div className="min-w-0 space-y-0.5 text-xs text-slate-600">
                <p className="break-words text-lg font-extrabold text-slate-900">{settings.businessName}</p>
                {addressLines.length ? (
                  <p className="flex items-start gap-1.5"><MapPin size={12} className="mt-0.5 shrink-0 text-teal-600" /><span className="break-words">{addressLines.join(", ")}</span></p>
                ) : null}
                {settings.email ? <p className="flex items-center gap-1.5"><Mail size={12} className="shrink-0 text-teal-600" /><span className="break-all">{settings.email}</span></p> : null}
                {settings.phone ? <p className="flex items-center gap-1.5"><MessageCircle size={12} className="shrink-0 text-teal-600" />{settings.phone}</p> : null}
                {isOwner && !addressLines.length && !settings.email && !settings.phone ? (
                  <Link href="/invoice/pengaturan" className="ppi-screen-only text-[11px] font-bold text-teal-700 underline">Isi alamat & kontak di Pengaturan</Link>
                ) : null}
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-3xl font-black tracking-wider text-teal-700 sm:text-4xl">{mode.title}</p>
              <div className="mt-2 space-y-1.5 rounded-xl border border-slate-200 p-2.5 text-xs sm:ml-auto sm:w-64">
                <div className="flex items-center justify-between gap-2">
                  <span className="shrink-0 font-semibold text-slate-500">No. {mode.label.split(" ")[0]}</span>
                  <span className="ppi-in boxed ppi-num !py-1.5 font-bold">{initial?.number ?? "Otomatis saat terbit"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="shrink-0 font-semibold text-slate-500">{mode.dateLabel}</span>
                  <DateFieldID value={issueDate} onChange={setIssueDate} className="ppi-in boxed ppi-num !py-1.5 !pr-8 font-bold" />
                </div>
                {mode.dueLabel ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="shrink-0 font-semibold text-slate-500">{mode.dueLabel}</span>
                    <DateFieldID value={dueDate} onChange={setDueDate} className="ppi-in boxed ppi-num !py-1.5 !pr-8 font-bold" />
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          {/* ===== Tabel item ===== */}
          <section className="mt-6">
            <div className="ppi-thead" style={{ "--ppi-cols": cols } as React.CSSProperties}>
              <span>Produk</span>
              <span>Keterangan</span>
              <span className="flex items-center justify-end gap-1.5">
                M² Bahan
                <button
                  type="button"
                  className="ppi-icon-btn"
                  title="Kalkulator m²: hitung luas dari panjang & lebar"
                  aria-label="Kalkulator meter persegi"
                  onClick={() => setCalcKey(lastM2Key ?? items[0]?.key ?? null)}
                >
                  <Calculator size={12} />
                </button>
              </span>
              <span className="text-right">Qty</span>
              {mode.showPrices ? <span className="text-right">Harga satuan</span> : null}
              {mode.showPrices ? <span className="text-right">Jumlah</span> : null}
              <span />
            </div>

            <div>
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
                  <div key={it.key} className="ppi-rowwrap py-2 md:py-0">
                    <div className="ppi-row" style={{ "--ppi-cols": cols } as React.CSSProperties}>
                      <label className="ppi-c-wide">
                        <span className="ppi-mlabel">Produk #{index + 1}</span>
                        <textarea
                          ref={grow}
                          rows={1}
                          value={it.productName}
                          onChange={(e) => patchItem(it.key, { productName: e.target.value })}
                          onInput={(e) => grow(e.currentTarget)}
                          spellCheck={false}
                          autoComplete="off"
                          className="ppi-in"
                          placeholder="Nama produk"
                        />
                      </label>
                      <label className="ppi-c-wide">
                        <span className="ppi-mlabel">Keterangan</span>
                        <textarea
                          ref={grow}
                          rows={1}
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
                        <span className="flex items-center gap-1">
                          <input
                            value={it.areaM2}
                            onChange={(e) => patchItem(it.key, { areaM2: e.target.value })}
                            onFocus={() => setLastM2Key(it.key)}
                            inputMode="decimal"
                            className="ppi-in ppi-num"
                            placeholder="0"
                          />
                          <button type="button" className="ppi-icon-btn md:hidden" aria-label={`Kalkulator m² baris ${index + 1}`} onClick={() => setCalcKey(it.key)}>
                            <Calculator size={12} />
                          </button>
                        </span>
                      </label>
                      <label>
                        <span className="ppi-mlabel">Qty</span>
                        <input
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
                            <span className="flex items-center gap-1">
                              <input
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
                          <div className="flex items-center justify-between gap-2 md:justify-end md:pt-1.5">
                            <span className="ppi-mlabel">Jumlah</span>
                            <span className="text-sm font-extrabold text-slate-900">{formatRupiah(row?.amount ?? 0)}</span>
                          </div>
                        </>
                      ) : null}
                      <div className="ppi-c-wide flex justify-end md:pt-1">
                        <button
                          type="button"
                          onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"
                          aria-label={`Hapus baris ${index + 1}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => setItems((l) => [...l, blankItem()])} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-700">
                <Plus size={14} /> Tambah Baris
              </button>
              <span className="text-xs text-slate-500">{filledCount} item</span>
              {mode.showTotals ? <span className="text-base font-extrabold text-slate-900">{formatRupiah(totals.subtotal)}</span> : <span />}
            </div>
          </section>

          {/* ===== Data customer ===== */}
          <button
            type="button"
            onClick={() => setShowCustomer(true)}
            className="ppi-screen-only mt-4 flex w-full items-center gap-3 rounded-2xl border border-dashed border-teal-400/70 bg-teal-50/50 px-3 py-2.5 text-left hover:bg-teal-50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700"><User size={16} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-teal-700">Data Customer</span>
              <span className="block truncate text-sm font-bold text-slate-800">
                {customerName ? `${customerName}${customerPhone ? ` · ${customerPhone}` : ""}` : "Belum diisi — klik untuk mengisi"}
              </span>
              <span className="block text-[10.5px] text-slate-500">
                {settings.showCustomerOnPrint ? "Ikut tercetak di lembar dokumen." : "Tidak ikut tercetak (bisa diubah di Pengaturan > Dokumen)."}
              </span>
            </span>
            <Pencil size={15} className="shrink-0 text-teal-700" />
          </button>
          {settings.showCustomerOnPrint && customerName ? (
            <div className="mt-3 text-xs text-slate-600">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Kepada</p>
              <p className="flex items-center gap-1.5 font-bold text-slate-900"><UserRound size={12} /> {customerName}</p>
              {customerPhone ? <p>{customerPhone}</p> : null}
            </div>
          ) : null}

          {/* ===== Monitoring produksi (hanya Invoice) ===== */}
          {docType === "invoice" ? (
            linkedOrder ? (
              <p className="ppi-screen-only mt-3 flex items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50/60 px-3 py-2 text-xs font-semibold text-teal-800">
                <Factory size={14} className="shrink-0" />
                <span>Tertaut ke pekerjaan produksi <Link href={`/pesanan/${linkedOrder.id}`} className="font-bold underline">{linkedOrder.code}</Link>. Harga dan pembayaran di pekerjaan ikut invoice ini.</span>
              </p>
            ) : editingIssued ? null : (
              <div className="ppi-screen-only mt-3 rounded-2xl border border-slate-200 p-3">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input type="checkbox" checked={needsProduction} onChange={(e) => setNeedsProduction(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-600" />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-bold text-slate-800"><Factory size={14} className="text-teal-600" /> Perlu monitoring produksi</span>
                    <span className="block text-[11px] text-slate-500">Saat invoice diterbitkan, pekerjaan otomatis masuk antrian produksi PrintFlow. Tidak dicentang = transaksi langsung (invoice saja).</span>
                  </span>
                </label>
                {needsProduction ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className="ppi-label">Deadline produksi *</span>
                      <DateFieldID value={prodDate} onChange={setProdDate} className="ppi-in boxed" />
                    </label>
                    <label className="block">
                      <span className="ppi-label">Jam deadline</span>
                      <input type="time" value={prodTime} onChange={(e) => setProdTime(e.target.value)} className="ppi-in boxed" />
                    </label>
                  </div>
                ) : null}
              </div>
            )
          ) : null}

          {/* ===== Pembayaran + total ===== */}
          {mode.showTotals ? (
            <section className={`mt-5 grid gap-4 ${mode.hasPayments ? "md:grid-cols-2" : ""}`}>
              {mode.hasPayments ? (
                <InvoicePayPanel
                  info={payInfo}
                  settings={settings}
                  isOwner={isOwner}
                  methodSlot={
                    <label className="block">
                      <span className="ppi-label">Metode pembayaran</span>
                      <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="ppi-in boxed">
                        {PAY_METHODS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </label>
                  }
                />
              ) : null}

              <div className={`space-y-2 text-sm ${mode.hasPayments ? "" : "md:ml-auto md:w-80"}`}>
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
                      className="ppi-in boxed ppi-num !w-24 !py-1"
                      aria-label="Nilai diskon"
                    />
                    <span className="ppi-seg">
                      <button type="button" className={discountType === "persen" ? "on" : ""} onClick={() => toggleDiscountType("persen")}>%</button>
                      <button type="button" className={discountType === "rp" ? "on" : ""} onClick={() => toggleDiscountType("rp")}>Rp</button>
                    </span>
                    <span className="w-24 text-right text-xs text-slate-500">{totals.discountAmount > 0 ? `- ${formatRupiah(totals.discountAmount)}` : "Rp 0"}</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700">PPN <span className="text-[10.5px] font-normal text-slate-400">(Pajak)</span></span>
                  <span className="flex items-center gap-1.5">
                    <input value={taxRate} onChange={(e) => setTaxRate(e.target.value)} inputMode="decimal" placeholder="0" className="ppi-in boxed ppi-num !w-16 !py-1" aria-label="Persen pajak" />
                    <span className="text-xs text-slate-500">%</span>
                    <span className="w-24 text-right text-xs text-slate-500">{formatRupiah(totals.taxAmount)}</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 border-t border-slate-200 pt-2">
                  <span className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Total akhir</span>
                  <span className="text-xl font-black text-slate-900">{formatRupiah(totals.total)}</span>
                </div>
                {docType === "invoice" && !editingIssued ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700">DP</span>
                    <input value={dp} onChange={(e) => setDp(thousands(e.target.value))} inputMode="numeric" placeholder="0" className="ppi-in boxed ppi-num !w-36 !py-1" aria-label="Nominal DP" />
                  </div>
                ) : null}
                {docType === "invoice" && !editingIssued ? <p className="text-[10.5px] text-slate-400">DP dicatat sebagai pembayaran pertama saat Terbitkan. Cicilan berikutnya lewat Catat Pembayaran.</p> : null}
                {docType === "invoice" ? (
                  editingIssued ? (
                    <Link href={`/invoice/${initial!.id}#pembayaran`} className="ppi-screen-only flex items-center justify-center gap-2 rounded-xl border border-dashed border-teal-400 py-2 text-xs font-bold text-teal-700 hover:bg-teal-50">
                      <Banknote size={14} /> Catat Pembayaran
                    </Link>
                  ) : (
                    <p className="ppi-screen-only flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2 text-xs font-bold text-slate-400">
                      <Banknote size={14} /> Catat Pembayaran (setelah diterbitkan)
                    </p>
                  )
                ) : null}
              </div>
            </section>
          ) : (
            <section className="mt-8 grid grid-cols-2 gap-6 text-center text-xs text-slate-700">
              <div><p>Pengirim,</p><div className="h-16" /><p className="border-t border-slate-400 pt-1 font-bold">{settings.businessName}</p></div>
              <div><p>Diterima oleh,</p><div className="h-16" /><p className="border-t border-slate-400 pt-1 font-bold">(nama &amp; tanda tangan)</p></div>
            </section>
          )}

          <InvoiceSignature settings={settings} />

          {/* ===== Syarat & ketentuan ===== */}
          <section className="mt-6 rounded-2xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-teal-700">Syarat &amp; ketentuan</p>
              <button type="button" onClick={() => setShowTermsEdit((v) => !v)} className="ppi-screen-only text-[11px] font-bold text-teal-700 underline">
                {showTermsEdit ? "Selesai" : "Ubah"}
              </button>
            </div>
            {showTermsEdit ? (
              <div className="mt-2 space-y-2">
                <textarea value={termsText} onChange={(e) => setTermsText(e.target.value)} rows={4} className="ppi-in boxed" placeholder="Satu syarat per baris" />
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="ppi-in boxed" placeholder="Catatan tambahan untuk pelanggan (opsional)" />
              </div>
            ) : (
              <>
                <ul className="mt-2 space-y-1">
                  {termsList.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-slate-600"><Check size={13} className="mt-0.5 shrink-0 text-teal-600" />{t}</li>
                  ))}
                  {termsList.length === 0 ? <li className="text-[11px] text-slate-400">Belum ada syarat.</li> : null}
                </ul>
                {notes ? <p className="mt-2 whitespace-pre-line text-[11px] text-slate-600">Catatan: {notes}</p> : null}
              </>
            )}
          </section>
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
            setLastM2Key(calcItem.key);
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
          names={customerNames}
          phones={phoneByName}
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
