import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { InvoiceFrame, InvoiceSidebar } from "@/components/InvoiceSidebar";
import { InvoiceSettingsForm } from "@/components/InvoiceSettingsForm";
import { ProblemScreen } from "@/components/ProblemScreen";
import { safeDb } from "@/lib/dbcheck";
import { getInvoiceAccess } from "@/lib/invoice-access";
import { getInvoiceSettings } from "@/lib/invoice-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pengaturan Invoice - Print Flow" };

export default async function InvoiceSettingsPage() {
  const loaded = await safeDb(async () => {
    const access = await getInvoiceAccess();
    if (!access || !access.isOwner) return null;
    return getInvoiceSettings();
  });
  if (!loaded.ok) return <ProblemScreen problem={loaded.problem} hint="Pengaturan disimpan di database." />;
  if (!loaded.data) redirect("/tidak-diizinkan");

  return (
    <InvoiceFrame sidebar={<InvoiceSidebar businessName={loaded.data.businessName} isOwner docType="semua" modeBehavior="filter" />}>
      <div className="space-y-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Settings size={20} strokeWidth={2.3} /> Pengaturan Invoice
          </h1>
          <p className="text-sm text-slate-500">Identitas usaha, rekening, dan aturan dokumen. Berlaku untuk semua jenis dokumen.</p>
        </div>
        <InvoiceSettingsForm initial={loaded.data} />
      </div>
    </InvoiceFrame>
  );
}
