import { NewOrderForm } from "@/components/NewOrderForm";
import { ProblemScreen } from "@/components/ProblemScreen";
import { safeDb } from "@/lib/dbcheck";
import { listCustomers } from "@/lib/queries";
import { listPartners } from "@/lib/outsource-queries";
import { listActiveEmployees } from "@/lib/user-queries";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const result = await safeDb(() => Promise.all([listCustomers(), listActiveEmployees(), listPartners()]));
  if (!result.ok) {
    return <ProblemScreen problem={result.problem} hint="Form ini butuh database untuk menyimpan pekerjaan baru." />;
  }
  const [customers, employees, partners] = result.data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 md:text-2xl dark:text-slate-100">➕ Pekerjaan Baru</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Isi data pekerjaan di kolom kiri. Kalau dikerjakan mitra, langsung isi kolom kanan — tidak perlu mampir ke
          halaman detail lagi.
        </p>
      </div>
      <NewOrderForm
        customers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
        operatorSuggestions={employees.map((e) => e.name)}
        partners={partners.map((p) => ({ id: p.id, name: p.name, kind: p.kind, phone: p.phone, active: p.active }))}
      />
    </div>
  );
}
