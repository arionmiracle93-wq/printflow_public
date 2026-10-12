import { Check, Mail, MapPin, MessageCircle, Receipt, User } from "lucide-react";
import { PaperLogo } from "@/components/PaperLogo";
import { InvoicePayPanel } from "@/components/InvoicePayPanel";
import { InvoiceSignature } from "@/components/InvoiceSignature";
import { formatDateID, formatRupiah } from "@/lib/domain";
import { docModeOf } from "@/lib/invoice-modes";
import { computePayInfo } from "@/lib/invoice-pay";
import type { InvoiceDetail } from "@/lib/invoice-queries";
import type { InvoiceSettings } from "@/lib/invoice-settings";
import { computeRowPricing } from "@/lib/invoice-pricing";

/**
 * KERTAS DOKUMEN (tampilan baca) - bentuknya sama dengan editor.
 * Server component murni: hanya menampilkan data yang sudah dihitung server.
 *  - Data customer di lembar HANYA tampil bila pengaturan "Tampilkan data customer
 *    di lembar cetak" menyala. Bar customer di layar tidak ikut tercetak.
 *  - Surat Jalan: tanpa harga/jumlah/total, ada kolom "Diterima oleh".
 */
export function InvoicePaper({ detail, settings, isOwner = false }: { detail: InvoiceDetail; settings: InvoiceSettings; isOwner?: boolean }) {
  const { invoice, items, summary } = detail;
  const mode = docModeOf(invoice.docType);
  const isDraft = invoice.status === "draft";
  const isVoid = invoice.status === "batal";
  const cols = mode.showPrices ? "24fr 22fr 13fr 8fr 15fr 14fr" : "40fr 36fr 14fr 10fr";
  const addressLines = settings.address.split(/\r?\n/).filter(Boolean);
  const payInfo = computePayInfo({
    total: invoice.total,
    paid: summary.paid,
    method: invoice.payMethod,
    number: invoice.number,
    uniqueCodeEnabled: settings.uniqueCode,
  });

  const stamp = isVoid ? { t: "BATAL", c: "border-rose-600 text-rose-600" } : isDraft ? { t: "DRAFT", c: "border-slate-500 text-slate-500" } : mode.hasPayments && summary.status === "lunas" ? { t: "LUNAS", c: "border-emerald-600 text-emerald-600" } : null;

  return (
    <article id="ppi-paper" className="ppi-paper px-4 pb-6 pt-8 sm:px-8">
      {stamp ? (
        <span aria-hidden className={`pointer-events-none absolute right-6 top-24 z-10 -rotate-12 select-none rounded-lg border-4 px-4 py-1 text-3xl font-black tracking-widest opacity-25 ${stamp.c}`}>
          {stamp.t}
        </span>
      ) : null}

      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <PaperLogo />
          <div className="min-w-0 space-y-0.5 text-xs text-slate-600">
            <p className="break-words text-lg font-extrabold text-slate-900">{settings.businessName}</p>
            {addressLines.length ? <p className="flex items-start gap-1.5"><MapPin size={12} className="mt-0.5 shrink-0 text-teal-600" /><span className="break-words">{addressLines.join(", ")}</span></p> : null}
            {settings.email ? <p className="flex items-center gap-1.5"><Mail size={12} className="shrink-0 text-teal-600" /><span className="break-all">{settings.email}</span></p> : null}
            {settings.phone ? <p className="flex items-center gap-1.5"><MessageCircle size={12} className="shrink-0 text-teal-600" />{settings.phone}</p> : null}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-3xl font-black tracking-wider text-teal-700 sm:text-4xl">{mode.title}</p>
          <div className="mt-2 space-y-1.5 rounded-xl border border-slate-200 p-2.5 text-xs sm:ml-auto sm:w-64">
            <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-500">No. {mode.label.split(" ")[0]}</span><b className="rounded-lg bg-slate-100 px-2 py-1">{invoice.number ?? `Draft #${invoice.id}`}</b></div>
            <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-500">{mode.dateLabel}</span><b className="rounded-lg bg-slate-100 px-2 py-1">{formatDateID(invoice.issueDate)}</b></div>
            {mode.dueLabel ? (
              <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-500">{mode.dueLabel}</span><b className="rounded-lg bg-slate-100 px-2 py-1">{invoice.dueDate ? formatDateID(invoice.dueDate) : "—"}</b></div>
            ) : null}
          </div>
        </div>
      </header>

      {/* ===== Tabel ===== */}
      <section className="mt-6">
        <div className="ppi-thead" style={{ "--ppi-cols": cols } as React.CSSProperties}>
          <span>Produk</span>
          <span>Keterangan</span>
          <span className="text-right">M² Bahan</span>
          <span className="text-right">Qty</span>
          {mode.showPrices ? <span className="text-right">Harga satuan</span> : null}
          {mode.showPrices ? <span className="text-right">Jumlah</span> : null}
        </div>
        {items.map((it) => {
          const p = computeRowPricing({ qty: it.qty, areaM2: it.areaM2, basePrice: it.basePrice, tiers: it.tiers });
          return (
            <div key={it.id} className="ppi-rowwrap py-2 md:py-1">
              <div className="ppi-row" style={{ "--ppi-cols": cols } as React.CSSProperties}>
                <div className="ppi-c-wide px-2 py-1.5 text-[13px] font-semibold text-slate-900"><span className="ppi-mlabel">Produk</span><span className="whitespace-pre-line break-words">{it.productName}</span></div>
                <div className="ppi-c-wide px-2 py-1.5 text-[13px] text-slate-600"><span className="ppi-mlabel">Keterangan</span><span className="whitespace-pre-line break-words">{it.description || "—"}</span></div>
                <div className="px-2 py-1.5 text-right text-[13px]"><span className="ppi-mlabel">M² bahan</span>{it.areaM2 > 0 ? String(it.areaM2).replace(".", ",") : "—"}</div>
                <div className="px-2 py-1.5 text-right text-[13px]"><span className="ppi-mlabel">Qty</span>{String(it.qty).replace(".", ",")}</div>
                {mode.showPrices ? (
                  <>
                    <div className="px-2 py-1.5 text-right text-[13px]">
                      <span className="ppi-mlabel">Harga satuan</span>
                      {formatRupiah(Math.round(it.unitPrice))}
                      {p.hasTier && p.tier ? <span className="block text-[10px] font-semibold text-teal-700">{p.label}</span> : null}
                    </div>
                    <div className="flex justify-between px-2 py-1.5 text-[13px] font-extrabold text-slate-900 md:justify-end"><span className="ppi-mlabel">Jumlah</span>{formatRupiah(it.amount)}</div>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
        {mode.showTotals ? (
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2 pt-3 text-xs text-slate-500">
            <span>{items.length} item</span>
            <span className="text-base font-extrabold text-slate-900">{formatRupiah(invoice.subtotal)}</span>
          </div>
        ) : null}
      </section>

      {/* ===== Data customer (bar layar; di lembar hanya bila diizinkan pengaturan) ===== */}
      <div className="ppi-screen-only mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-teal-400/70 bg-teal-50/50 px-3 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700"><User size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-teal-700">Data Customer</span>
          <span className="block truncate text-sm font-bold text-slate-800">{invoice.customerName}{invoice.customerPhone ? ` · ${invoice.customerPhone}` : ""}</span>
          <span className="block text-[10.5px] text-slate-500">{settings.showCustomerOnPrint ? "Ikut tercetak di lembar dokumen." : "Tidak ikut tercetak (bisa diubah di Pengaturan > Dokumen)."}</span>
        </span>
      </div>
      {settings.showCustomerOnPrint ? (
        <div className="mt-3 text-xs text-slate-600">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Kepada</p>
          <p className="font-bold text-slate-900">{invoice.customerName}</p>
          {invoice.customerPhone ? <p>{invoice.customerPhone}</p> : null}
        </div>
      ) : null}

      {/* ===== Pembayaran + total ===== */}
      {mode.showTotals ? (
        <section className={`mt-5 grid gap-4 ${mode.hasPayments ? "md:grid-cols-2" : ""}`}>
          {mode.hasPayments ? (
            <InvoicePayPanel
              info={payInfo}
              settings={settings}
              isOwner={isOwner}
              showAmountBox={!isDraft && !isVoid}
              methodSlot={
                <div>
                  <span className="ppi-label">Metode pembayaran</span>
                  <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><Receipt size={14} className="text-teal-600" /> {invoice.payMethod}</p>
                </div>
              }
            />
          ) : null}

          <div className={`space-y-2 text-sm ${mode.hasPayments ? "" : "md:ml-auto md:w-80"}`}>
            <div className="flex items-baseline justify-between gap-2"><span className="text-slate-600">Subtotal <span className="text-[10.5px] text-slate-400">(Sebelum Diskon &amp; Pajak)</span></span><b>{formatRupiah(invoice.subtotal)}</b></div>
            {invoice.discountAmount > 0 ? (
              <div className="flex items-baseline justify-between gap-2 text-slate-600"><span>Diskon {invoice.discountType === "persen" ? `${invoice.discountRate}%` : "(Rp)"}</span><span>- {formatRupiah(invoice.discountAmount)}</span></div>
            ) : null}
            {invoice.taxAmount > 0 ? (
              <div className="flex items-baseline justify-between gap-2 text-slate-600"><span>PPN {invoice.taxRate}%</span><span>{formatRupiah(invoice.taxAmount)}</span></div>
            ) : null}
            <div className="flex items-baseline justify-between gap-2 border-t border-slate-200 pt-2"><span className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Total akhir</span><span className="text-xl font-black text-slate-900">{formatRupiah(invoice.total)}</span></div>
            {mode.hasPayments && !isDraft ? (
              <>
                <div className="flex justify-between text-emerald-700"><span>Terbayar</span><span>{formatRupiah(summary.paid)}</span></div>
                <div className={`flex justify-between font-bold ${summary.remaining > 0 && !isVoid ? "text-rose-600" : "text-slate-500"}`}><span>Sisa tagihan</span><span>{formatRupiah(summary.remaining)}</span></div>
              </>
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

      {invoice.terms.length || invoice.notes ? (
        <section className="mt-6 rounded-2xl border border-slate-200 p-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-teal-700">Syarat &amp; ketentuan</p>
          <ul className="mt-2 space-y-1">
            {invoice.terms.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-slate-600"><Check size={13} className="mt-0.5 shrink-0 text-teal-600" />{t}</li>
            ))}
          </ul>
          {invoice.notes ? <p className="mt-2 whitespace-pre-line text-[11px] text-slate-600">Catatan: {invoice.notes}</p> : null}
        </section>
      ) : null}

      {isVoid && invoice.voidReason ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">Dibatalkan: {invoice.voidReason}</p> : null}
    </article>
  );
}
