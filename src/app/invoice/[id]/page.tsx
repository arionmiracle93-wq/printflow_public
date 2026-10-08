import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClipboardList, History, Link2 } from "lucide-react";
import { InvoiceActions } from "@/components/InvoiceActions";
import { InvoiceOutputActions } from "@/components/InvoiceOutputActions";
import { ProductionCreator } from "@/components/ProductionCreator";
import { ReminderModalHost } from "@/components/ReminderModal";
import { InvoiceStatusBadge, PayStatusBadge, ProductionMirrorBadge } from "@/components/InvoiceBadges";
import { InvoicePaper } from "@/components/InvoicePaper";
import { InvoicePaymentPanel } from "@/components/InvoicePaymentPanel";
import { InvoiceFrame, InvoiceSidebar } from "@/components/InvoiceSidebar";
import { ProblemScreen } from "@/components/ProblemScreen";
import { safeDb } from "@/lib/dbcheck";
import { formatDateTimeID, jakartaDateISO } from "@/lib/domain";
import { getInvoiceAccess } from "@/lib/invoice-access";
import { DOC_MODES, docModeOf } from "@/lib/invoice-modes";
import { getInvoiceDetail } from "@/lib/invoice-queries";
import { dueStatus } from "@/lib/invoice-due";
import { computePayInfo } from "@/lib/invoice-pay";
import { buildWhatsAppMessage, formatWhatsAppNumber } from "@/lib/invoice-share";
import { getInvoiceSettings } from "@/lib/invoice-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detail Dokumen - Print Flow" };

export default async function InvoiceDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tagih?: string }> }) {
  const id = Number.parseInt((await params).id, 10);
  const sp = await searchParams;
  const loaded = await safeDb(async () => {
    const access = await getInvoiceAccess();
    if (!access) return null;
    const [detail, settings] = await Promise.all([getInvoiceDetail(id), getInvoiceSettings()]);
    return { access, detail, settings };
  });
  if (!loaded.ok) return <ProblemScreen problem={loaded.problem} hint="Data dokumen disimpan di database." />;
  if (!loaded.data) redirect("/tidak-diizinkan");
  const { access, detail, settings } = loaded.data;
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
        <div className="min-w-0">
          <h1 className="page-title break-words">{invoice.number ?? `Draft #${invoice.id}`}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`chip ${mode.badge}`}>{mode.label}</span>
            <InvoiceStatusBadge status={invoice.status} />
            {mode.hasPayments ? <PayStatusBadge payStatus={invoice.payStatus} status={invoice.status} /> : null}
            <ProductionMirrorBadge status={order?.status ?? null} />
          </div>
          {source || activeConverted.length ? (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
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

        <div className="space-y-2 lg:hidden">
          <InvoiceActions layout="row" {...actionProps} />
          <InvoiceOutputActions layout="row" {...outputProps} />
        </div>

        {canRemind ? (
          <ReminderModalHost invoiceId={invoice.id} ctx={reminderCtx} initialPhone={invoice.customerPhone ?? ""} autoOpen={sp.tagih === "1"} />
        ) : null}

        <InvoicePaper detail={detail} settings={settings} isOwner={access.isOwner} />

        {mode.hasPayments ? (
          <div id="pembayaran" className="scroll-mt-24">
            <InvoicePaymentPanel
              invoiceId={invoice.id}
              status={invoice.status}
              total={invoice.total}
              paid={summary.paid}
              remaining={summary.remaining}
              isOwner={access.isOwner}
              today={jakartaDateISO()}
              defaultMethod={invoice.payMethod}
              payments={payments.map((p) => ({
                id: p.id,
                kind: p.kind,
                amount: p.amount,
                method: p.method,
                paidAt: p.paidAt.toISOString(),
                note: p.note,
                createdBy: p.createdBy,
                voidedAt: p.voidedAt ? p.voidedAt.toISOString() : null,
                voidedBy: p.voidedBy,
                voidReason: p.voidReason,
              }))}
            />
          </div>
        ) : null}

        {canMakeProduction ? <ProductionCreator invoiceId={invoice.id} today={jakartaDateISO()} /> : null}

        {!order && invoice.status === "draft" && invoice.needsProduction && invoice.prodDueDate ? (
          <p className="flex items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50/60 px-3 py-2 text-xs font-semibold text-teal-800">
            <ClipboardList size={14} className="shrink-0" />
            Saat diterbitkan, pekerjaan produksi otomatis dibuat dengan deadline {invoice.prodDueDate} {invoice.prodDueTime ?? "17:00"}.
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
    </InvoiceFrame>
  );
}
