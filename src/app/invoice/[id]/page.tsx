import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClipboardList, History, Link2 } from "lucide-react";
import { InvoiceActions } from "@/components/InvoiceActions";
import { InvoiceOutputActions } from "@/components/InvoiceOutputActions";
import { ProductionAdder } from "@/components/ProductionAdder";
import { ProductionCreator } from "@/components/ProductionCreator";
import { ReminderModalHost } from "@/components/ReminderModal";
import { InvoiceStatusBadge, PayStatusBadge, ProductionMirrorBadge } from "@/components/InvoiceBadges";
import { InvoicePaper } from "@/components/InvoicePaper";
import { InvoicePaymentPanel } from "@/components/InvoicePaymentPanel";
import { InvoiceFrame, InvoiceSidebar } from "@/components/InvoiceSidebar";
import { ProblemScreen } from "@/components/ProblemScreen";
import { safeDb } from "@/lib/dbcheck";
import { customerLabel, formatDateTimeID, formatRupiah, jakartaDateISO } from "@/lib/domain";
import { getInvoiceAccess } from "@/lib/invoice-access";
import { DOC_MODES, docModeOf } from "@/lib/invoice-modes";
import { getInvoiceDetail } from "@/lib/invoice-queries";
import { dueStatus } from "@/lib/invoice-due";
import { unmatchedInvoiceItems } from "@/lib/production-sync";
import { itemsByOrderId } from "@/lib/queries";
import { computePayInfo } from "@/lib/invoice-pay";
import { buildWhatsAppMessage, formatWhatsAppNumber } from "@/lib/invoice-share";
import { getInvoiceSettings } from "@/lib/invoice-settings";
import { buildReceiptLines } from "@/lib/thermal-receipt";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detail Dokumen - Print Flow" };

export default async function InvoiceDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tagih?: string }> }) {
  const id = Number.parseInt((await params).id, 10);
  const sp = await searchParams;
  const loaded = await safeDb(async () => {
    const access = await getInvoiceAccess();
    if (!access) return null;
    const [detail, settings] = await Promise.all([getInvoiceDetail(id), getInvoiceSettings()]);
    const linkedItems = detail?.order
      ? (await itemsByOrderId([detail.order.id])).get(detail.order.id) ?? []
      : [];
    return { access, detail, settings, linkedItems };
  });
  if (!loaded.ok) return <ProblemScreen problem={loaded.problem} hint="Data dokumen disimpan di database." />;
  if (!loaded.data) redirect("/tidak-diizinkan?dari=invoice");
  const { access, detail, settings, linkedItems } = loaded.data;
  if (!detail) notFound();

  const { invoice, payments, events, order, summary, source, converted } = detail;
  const mode = docModeOf(invoice.docType);
  const activePayments = payments.some((p) => !p.voidedAt);
  // Karyawan tidak boleh mengedit invoice yang sudah ada pembayarannya (server juga menolak).
  const canEdit = access.isOwner || !(invoice.status === "terbit" && activePayments);
  const activeConverted = converted.filter((c) => c.status !== "batal");
  const payInfo = computePayInfo({
    total: invoice.total,
    paid: summary.paid,
    method: invoice.payMethod,
    number: invoice.number,
    uniqueCodeEnabled: settings.uniqueCode,
  });
  const waText = buildWhatsAppMessage(
    { ...invoice, items: detail.items.map((i) => ({ productName: i.productName, qty: i.qty, areaM2: i.areaM2, unitPrice: i.unitPrice, amount: i.amount })) },
    settings,
    payInfo,
    summary.paid,
  );
  const outputProps = {
    fileBase: `${mode.label.replace(/\s+/g, "")}_${invoice.number ?? `draft-${invoice.id}`}`,
    waText,
    waPhone: formatWhatsAppNumber(invoice.customerPhone),
    showPdf: settings.showPdfButton,
    showWa: settings.showWaButton,
    receipt: buildReceiptLines(detail, settings),
    disabled: invoice.status === "batal",
  };
  const activePays = payments.filter((p) => !p.voidedAt);
  const reminderCtx = {
    businessName: settings.businessName,
    customerName: invoice.customerName,
    number: invoice.number ?? "",
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    total: invoice.total,
    dp: activePays.filter((p) => p.kind === "dp").reduce((n, p) => n + p.amount, 0),
    installmentCount: activePays.filter((p) => p.kind !== "dp").length,
    installmentTotal: activePays.filter((p) => p.kind !== "dp").reduce((n, p) => n + p.amount, 0),
    paid: summary.paid,
    base: payInfo.base,
    code: payInfo.code,
    payable: payInfo.payable,
    payMethod: invoice.payMethod,
    banks: settings.banks,
    due: dueStatus(invoice.dueDate, false, jakartaDateISO()),
  };
  const canRemind = invoice.docType === "invoice" && invoice.status === "terbit" && summary.remaining > 0;
  const canMakeProduction = invoice.docType === "invoice" && invoice.status === "terbit" && !order;
  const productionItemCount = detail.items.filter((item) => item.needsProduction).length;
  const productionCandidates = order
    ? unmatchedInvoiceItems(detail.items, linkedItems).flatMap((item) =>
        item.needsProduction && item.lineKey
          ? [
              {
                lineKey: item.lineKey,
                productName: item.productName,
                quantity: item.qty,
                unit: item.unit,
                prodDueDate: item.prodDueDate,
                prodDueTime: item.prodDueTime,
              },
            ]
          : [],
      )
    : [];
  /* Porsi pembayaran dalam persen untuk batang ringkasan di HP.
     Dijepit 0-100: pembayaran bisa melebihi total (kelebihan transfer),
     dan batang di atas 100% akan meluber keluar wadahnya. */
  const porsiPersen = invoice.total > 0 ? Math.min(100, Math.max(0, Math.round((summary.paid / invoice.total) * 100))) : 0;

  const actionProps = {
    id: invoice.id,
    docType: invoice.docType,
    status: invoice.status,
    isOwner: access.isOwner,
    canEdit,
    hasActivePayments: activePayments,
    remaining: summary.remaining,
    payMethod: invoice.payMethod,
    alreadyConverted: activeConverted.length > 0,
    label: `${invoice.number ?? `Draft #${invoice.id}`} · ${customerLabel(invoice.customerName)}`,
  };

  return (
    <InvoiceFrame
      sidebar={
        <InvoiceSidebar
          businessName={settings.businessName}
          isOwner={access.isOwner}
          docType={mode.key}
          modeBehavior="fixed"
          actions={
            <>
              <InvoiceActions layout="side" {...actionProps} />
              <InvoiceOutputActions layout="side" {...outputProps} />
            </>
          }
        />
      }
    >
      <div className="space-y-4">
        {/* RINGKASAN DOKUMEN
            Di HP blok ini ikut menempel (sticky) di bawah header aplikasi
            supaya nomor, total, dan sisa tagihan tetap kelihatan saat
            pengguna menggulir halaman yang panjang ini.

            top-[60px] = tinggi header aplikasi di layar sempit (tombol
            40px + padding 10pxx2). Nilai yang sama sudah dipakai
            OrderDetailTabs, jadi tidak ada angka baru yang meleset.

            Di layar lebar blok ini seperti biasa: flows di dalam konten,
            tidak sticky - sidebar sudah menyediakan ruang navigasi, jadi
            tidak perlu mencuri tinggi layar. */}
        {/* JARAK KE KERTAS

            Class ini dulu punya "lg:mb-0" dan "mb-3". Keduanya menimpa
            jarak yang sebenarnya, dan itu yang membuat deretan badge
            menempel tepat di garis warna paling atas kertas.

            Perlu tahu bentuk space-y di Tailwind v4: jarak datang
            dari margin-bottom anak PERTAMA, bukan margin-top anak kedua.

              :where(.space-y-4 > :not(:last-child)) {
                --tw-space-y-reverse: 0;
                margin-block-end: calc(calc(var(--spacing)*4)*calc(1 - 0));
              }

            Jadi setiap kelas mb-* yang menempel pada blok ini langsung
            menggantikan 16px milik space-y:

              dengan lg:mb-0  -> 0px  di layar lebar (badge menempel)
              dengan mb-3     -> 12px di semua lebar

            Keduanya dihapus, jadi jarak sekarang benar-benar milik
            space-y-4: 16px, sama seperti jarak antar elemen lain di
            halaman ini. Diukur: 0px sebelum, 16px sesudah, di 360,
            390, 1024, dan 1280px.

            Yang lain tidak diubah: "lg:static", "lg:z-auto", "lg:mx-0",
            "lg:border-0", "lg:bg-transparent", "lg:p-0", dan
            "lg:backdrop-blur-none" semuanya masih dipakai. */}
        <div className="sticky top-[60px] z-20 -mx-3 border-b border-[color:var(--pf-line-soft)] bg-[color:var(--pf-page)]/95 px-3 py-2 backdrop-blur-md sm:-mx-4 sm:px-4 lg:static lg:z-auto lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <div className="flex items-start justify-between gap-3">
            {/* Nomor + badge SEJADAR BARIS: nomor di kiri, badge mengalir ke
                kanan pada baris yang sama. Barisnya dibungkus flex-wrap,
                jadi di layar sempit badge turun ke baris kedua dengan
                sendirinya - tidak pernah terpotong dan tidak pernah
                menabrak nomor.

                Sebelumnya badge ada di baris kedua DI BAWAH nomor, sehingga
                kepala halaman jadi dua lapis dan penanda status yang paling
                penting justru terpisah dari konteksnya. */}
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
              <h1 className="page-title break-words">{invoice.number ?? `Draft #${invoice.id}`}</h1>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`chip ${mode.badge}`}>{mode.label}</span>
                <InvoiceStatusBadge status={invoice.status} />
                {mode.hasPayments ? <PayStatusBadge payStatus={invoice.payStatus} status={invoice.status} /> : null}
                <ProductionMirrorBadge status={order?.status ?? null} />
              </div>
            </div>

            {/* Blok "TOTAL / Rp xx" DIHAPUS dari sini.

                Dulu hanya tampil di layar kecil (lg:hidden), dengan alasan
                nominal tidak ikut terlihat sebelum pengguna menggulir ke
                kertas. Setelah deretan badge dirapikan jadi satu baris dan
                kertas invoice sendiri sudah menampilkan total dengan jelas,
                blok itu hanya jadi angka kedua di layar yang sama.

                Yang tersisa: deretan empat status dalam satu baris - mode
                dokumen, status terbit, status bayar, dan status produksi dari
                pekerjaan yang berelasi. */}
          </div>

          {/* Batang "+ sisa tagihan" hanya kalau dokumen ini punya
              pembayaran. Persentase dijepit 0-100 supaya pembayaran
              berlebih tidak membuat batang meluber melewati wadahnya. */}
          {mode.hasPayments && mode.showTotals && invoice.total > 0 ? (
            <div className="mt-2 lg:hidden">
              <div
                className="h-1.5 overflow-hidden rounded-full bg-[color:var(--pf-surface-3)]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={porsiPersen}
                aria-label="Porsi pembayaran yang sudah diterima"
              >
                <div
                  className={`h-full rounded-full transition-[width] ${summary.remaining > 0 ? "bg-amber-500" : "bg-[color:var(--pf-accent)]"}`}
                  style={{ width: `${porsiPersen}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-[10.5px] text-slate-500">Terbayar {formatRupiah(summary.paid)}</span>
                {summary.remaining > 0 && invoice.status === "terbit" ? (
                  <span className="shrink-0 text-[11px] font-bold text-rose-600">Sisa {formatRupiah(summary.remaining)}</span>
                ) : invoice.status === "terbit" ? (
                  <span className="shrink-0 text-[11px] font-bold text-emerald-700">Lunas</span>
                ) : null}
              </div>
            </div>
          ) : null}

          {source || activeConverted.length ? (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <Link2 size={13} />
              {source ? (
                <span>
                  Dibuat dari{" "}
                  <Link href={`/invoice/${source.id}`} className="font-bold text-teal-700 hover:underline">
                    {DOC_MODES[docModeOf(source.docType).key].label} {source.number ?? `#${source.id}`}
                  </Link>
                </span>
              ) : null}
              {activeConverted.map((c) => (
                <span key={c.id}>
                  Sudah dijadikan Invoice{" "}
                  <Link href={`/invoice/${c.id}`} className="font-bold text-teal-700 hover:underline">
                    {c.number ?? `draft #${c.id}`}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </div>

        {/* Tautan "Dibuat dari / Sudah dijadikan Invoice" SENGAJA di luar
            blok sticky. Isinya bebas panjang (bisa jadi beberapa baris di
            360px), dan kalau ikut menempel, baris ringkasan bisa tumbuh
            jadi ~200px dan menutup hampir seperempat layar. */}

        {/* Tombol aksi HP TIDAK lagi dirender di sini.

            Sempat berupa dua baris tombol lebar penuh tepat di atas
            kertas, yang di 360px memakan lebih tinggi dari kepala
            dokumennya - pengguna harus menggulir melewati tombol dulu
            sebelum sampai ke isi tagihan yang justru mau dibaca.

            Sekarang tombolnya ikut lewat `actions` ke InvoiceSidebar dan
            muncul dari menu geser tiga garis di paling kiri. Di lg ke atas
            sidebar tetap menampilkan kolom action-nya seperti sebelumnya,
            jadi tidak ada yang hilang di layar lebar. */}

        {canRemind ? (
          <ReminderModalHost invoiceId={invoice.id} ctx={reminderCtx} initialPhone={invoice.customerPhone ?? ""} autoOpen={sp.tagih === "1"} />
        ) : null}

        <InvoicePaper detail={detail} settings={settings} isOwner={access.isOwner} />

        {/* Panel pendamping kertas invoice.
            Di layar lebar panel-panel ini dipecah 2 kolom supaya tidak
            melar selebar kertas: pembayaran di kiri, lalu tambah-produksi,
            produksi, dan riwayat aktivitas bertumpuk di kanan. Di HP tetap
            1 kolom seperti sebelumnya. Class grid-cols HANYA dipasang kalau
            panel pembayaran memang ada; kalau tidak (mis. penawaran),
            kolom kanan otomatis memakai lebar penuh. */}
        <div className={`grid gap-4 ${mode.hasPayments ? "md:grid-cols-2 md:items-start" : ""}`}>
          {mode.hasPayments ? (
            <div id="pembayaran" className="min-w-0 scroll-mt-24">
              <InvoicePaymentPanel
                invoiceId={invoice.id}
                status={invoice.status}
                total={invoice.total}
                paid={summary.paid}
                remaining={summary.remaining}
                isOwner={access.isOwner}
                today={jakartaDateISO()}
                defaultMethod={invoice.payMethod}
                label={actionProps.label}
                payments={payments.map((p) => ({
                  id: p.id,
                  kind: p.kind,
                  amount: p.amount,
                  method: p.method,
                  paidAt: p.paidAt.toISOString(),
                  note: p.note,
                  reference: p.reference,
                  createdBy: p.createdBy,
                  voidedAt: p.voidedAt ? p.voidedAt.toISOString() : null,
                  voidedBy: p.voidedBy,
                  voidReason: p.voidReason,
                }))}
              />
            </div>
          ) : null}

          <div className="min-w-0 space-y-4">
            {canMakeProduction ? (
              <ProductionCreator
                invoiceId={invoice.id}
                today={jakartaDateISO()}
                items={detail.items.map((item) => ({
                  id: item.id,
                  productName: item.productName,
                  quantity: item.qty,
                  unit: item.unit,
                  needsProduction: item.needsProduction,
                  prodDueDate: item.prodDueDate,
                  prodDueTime: item.prodDueTime,
                }))}
              />
            ) : null}

            {order && invoice.docType === "invoice" && invoice.status === "terbit" && productionCandidates.length ? (
              <ProductionAdder
                key={productionCandidates.map((item) => item.lineKey).join("|")}
                invoiceId={invoice.id}
                orderCode={order.code}
                orderStatus={order.status}
                today={jakartaDateISO()}
                items={productionCandidates}
              />
            ) : null}

            {!order && invoice.status === "draft" && invoice.needsProduction && invoice.prodDueDate ? (
              <p className="flex items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50/60 px-3 py-2 text-xs font-semibold text-teal-800">
                <ClipboardList size={14} className="shrink-0" />
                Saat diterbitkan, pekerjaan produksi otomatis dibuat untuk {productionItemCount} item dengan deadline utama {invoice.prodDueDate} {invoice.prodDueTime ?? "17:00"}.
              </p>
            ) : null}

            {order ? (
              <section className="card space-y-1 p-4">
                <div className="flex items-center gap-2">
                  <ClipboardList size={17} className="text-teal-600" />
                  <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Produksi</h2>
                </div>
                <p className="text-xs text-slate-500">
                  Tertaut ke pekerjaan{" "}
                  <Link href={`/pesanan/${order.id}`} className="font-bold text-teal-700 hover:underline">
                    {order.code}
                  </Link>
                  . Status produksi di sini hanya cermin, ubahnya dari halaman pekerjaan.
                </p>
                <ProductionMirrorBadge status={order.status} />
              </section>
            ) : null}

            <section className="card p-4">
              <div className="mb-2 flex items-center gap-2">
                <History size={17} className="text-teal-600" />
                <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Riwayat aktivitas</h2>
              </div>
              <ul className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="text-xs">
                    <p className="break-words text-slate-700 dark:text-slate-300">{e.detail ?? e.kind}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatDateTimeID(e.createdAt)} · {e.actor}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </InvoiceFrame>
  );
}
