import { redirect } from "next/navigation";
import { getInvoiceForOrder, getOrderPrefill } from "@/lib/invoice-queries";
import { InvoicePaperEditor } from "@/components/InvoicePaperEditor";
import { ProblemScreen } from "@/components/ProblemScreen";
import { safeDb } from "@/lib/dbcheck";
import { jakartaDateISO } from "@/lib/domain";
import { getInvoiceAccess } from "@/lib/invoice-access";
import { isDocType } from "@/lib/invoice-modes";
import { getInvoiceSettings } from "@/lib/invoice-settings";
import { listCustomers } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dokumen Baru - Print Flow" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ m?: string; dariPesanan?: string }> }) {
  const sp = await searchParams;
  const loaded = await safeDb(async () => {
    const access = await getInvoiceAccess();
    if (!access) return null;
    const [customers, settings] = await Promise.all([listCustomers(), getInvoiceSettings()]);
    const orderId = Number.parseInt(sp.dariPesanan ?? "", 10);
    const prefill = Number.isInteger(orderId) && orderId > 0 ? await getOrderPrefill(orderId) : null;
    const existing = prefill ? await getInvoiceForOrder(prefill.order.id) : null;
    return { access, customers, settings, prefill, existing };
  });
  if (!loaded.ok) return <ProblemScreen problem={loaded.problem} hint="Form dokumen butuh database." />;
  if (!loaded.data) redirect("/tidak-diizinkan");
  const { access, customers, settings, prefill, existing } = loaded.data;
  // 1 invoice = 1 pekerjaan: bila pekerjaan ini sudah punya invoice, buka yang itu saja.
  if (existing) redirect(`/invoice/${existing.id}`);

  return (
    <InvoicePaperEditor
      customers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
      settings={settings}
      today={jakartaDateISO()}
      isOwner={access.isOwner}
      newDocType={prefill ? "invoice" : isDocType(sp.m) ? sp.m : "invoice"}
      prefill={
        prefill
          ? {
              customerName: prefill.order.customerName,
              customerPhone: prefill.phone ?? "",
              items: prefill.items.map((it) => ({ productName: it.productType, qty: it.quantity, unit: it.unit })),
            }
          : undefined
      }
      linkedOrder={prefill ? { id: prefill.order.id, code: prefill.order.code } : null}
    />
  );
}
