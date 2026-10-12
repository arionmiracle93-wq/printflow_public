import { notFound, redirect } from "next/navigation";
import { InvoicePaperEditor, type EditorInitial } from "@/components/InvoicePaperEditor";
import { ProblemScreen } from "@/components/ProblemScreen";
import { safeDb } from "@/lib/dbcheck";
import { jakartaDateISO } from "@/lib/domain";
import { getInvoiceAccess } from "@/lib/invoice-access";
import { docModeOf } from "@/lib/invoice-modes";
import { getInvoiceDetail } from "@/lib/invoice-queries";
import { getInvoiceSettings } from "@/lib/invoice-settings";
import { listCustomers } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Dokumen - Print Flow" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number.parseInt((await params).id, 10);
  const loaded = await safeDb(async () => {
    const access = await getInvoiceAccess();
    if (!access) return null;
    const [detail, customers, settings] = await Promise.all([getInvoiceDetail(id), listCustomers(), getInvoiceSettings()]);
    return { access, detail, customers, settings };
  });
  if (!loaded.ok) return <ProblemScreen problem={loaded.problem} hint="Form dokumen butuh database." />;
  if (!loaded.data) redirect("/tidak-diizinkan");
  const { access, detail, customers, settings } = loaded.data;
  if (!detail) notFound();
  const inv = detail.invoice;
  if (inv.status === "batal") redirect(`/invoice/${id}`);
  // Karyawan tidak boleh mengedit invoice yang sudah ada pembayarannya (server juga menolak).
  if (!access.isOwner && inv.status === "terbit" && detail.payments.some((p) => !p.voidedAt)) redirect(`/invoice/${id}`);

  const mode = docModeOf(inv.docType);
  const initial: EditorInitial = {
    id: inv.id,
    version: inv.version,
    status: inv.status as EditorInitial["status"],
    number: inv.number,
    docType: mode.key,
    customerName: inv.customerName,
    customerPhone: inv.customerPhone ?? "",
    issueDate: inv.issueDate,
    dueDate: inv.dueDate ?? "",
    payMethod: inv.payMethod,
    discountType: inv.discountType === "rp" ? "rp" : "persen",
    discountInput: inv.discountInput,
    taxRate: inv.taxRate,
    notes: inv.notes ?? "",
    terms: inv.terms,
    paidAmount: inv.paidAmount,
    needsProduction: inv.needsProduction,
    prodDueDate: inv.prodDueDate ?? "",
    prodDueTime: inv.prodDueTime ?? "17:00",
    items: detail.items.map((it) => ({
      productName: it.productName,
      description: it.description ?? "",
      unit: it.unit,
      qty: it.qty,
      areaM2: it.areaM2,
      basePrice: it.basePrice,
      tiers: it.tiers,
    })),
  };

  return (
    <InvoicePaperEditor
      customers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
      settings={settings}
      today={jakartaDateISO()}
      isOwner={access.isOwner}
      initial={initial}
      linkedOrder={detail.order ? { id: detail.order.id, code: detail.order.code } : null}
    />
  );
}
