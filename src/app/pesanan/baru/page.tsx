import { NewOrderForm } from "@/components/NewOrderForm";
import { ProblemScreen } from "@/components/ProblemScreen";
import { safeDb } from "@/lib/dbcheck";
import { listCustomers } from "@/lib/queries";
import { listActiveEmployees } from "@/lib/user-queries";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const result = await safeDb(() => Promise.all([listCustomers(), listActiveEmployees()]));
  if (!result.ok) {
    return <ProblemScreen problem={result.problem} hint="Form ini butuh database untuk menyimpan pekerjaan baru." />;
  }
  const [customers, employees] = result.data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 md:text-2xl">➕ Pekerjaan Baru</h1>
        <p className="text-sm text-slate-500">
          Isi 3 langkah singkat. Setelah disimpan, AI langsung memantau status dan risiko telatnya.
        </p>
      </div>
      <NewOrderForm
        customers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
        operatorSuggestions={employees.map((e) => e.name)}
      />
    </div>
  );
}
