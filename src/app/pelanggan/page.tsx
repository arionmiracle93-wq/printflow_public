import Link from "next/link";
import { MapPin, Plus, StickyNote, User, Users } from "lucide-react";
import { CustomerForm } from "@/components/CustomerForm";
import { ProblemScreen } from "@/components/ProblemScreen";
import { safeDb } from "@/lib/dbcheck";
import { formatDateID, formatRupiah } from "@/lib/domain";
import { listCustomers, listOrders } from "@/lib/queries";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const loaded = await safeDb(() => Promise.all([listCustomers(), listOrders({ scope: "semua" })]));
  if (!loaded.ok) {
    return <ProblemScreen problem={loaded.problem} hint="Data pelanggan disimpan di database." />;
  }
  const [customers, orders] = loaded.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Users size={22} strokeWidth={2.3} /> Pelanggan
          </h1>
          <p className="text-sm text-slate-500">{customers.length} pelanggan terdaftar</p>
        </div>
        <CustomerForm />
      </div>

      {customers.length === 0 ? (
        <EmptyState
          icon={<Users size={26} />}
          title="Belum ada pelanggan"
          description="Pelanggan otomatis tercatat saat Anda membuat pekerjaan dan mengetik namanya. Bisa juga ditambahkan lewat formulir di halaman ini."
          action={{ href: "/pesanan/baru", label: "Buat pekerjaan", icon: <Plus size={15} /> }}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {customers.map((customer) => {
            const list = orders.filter((o) => o.customerName === customer.name);
            const total = list.reduce((sum, o) => sum + o.price, 0);
            const active = list.filter((o) => !["selesai", "batal"].includes(o.status)).length;
            return (
              <div key={customer.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{customer.name}</p>
                    <p className="text-xs text-slate-500">{customer.phone ?? "-"}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="chip border-teal-200 bg-teal-50 text-teal-700">{active} aktif</span>
                  </div>
                </div>
                {customer.address ? (
                  <p className="mt-2 flex items-start gap-1 text-xs text-slate-500">
                    <MapPin size={13} className="mt-0.5 shrink-0" /> {customer.address}
                  </p>
                ) : null}
                {customer.notes ? (
                  <p className="mt-1 flex items-start gap-1 text-xs text-slate-500">
                    <StickyNote size={13} className="mt-0.5 shrink-0" /> {customer.notes}
                  </p>
                ) : null}
                <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                  <span>{list.length} pekerjaan total</span>
                  <span className="font-bold text-slate-800">{formatRupiah(total)}</span>
                </div>
                {list.length ? (
                  <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                    {list.slice(0, 3).map((o) => (
                      <li key={o.id}>
                        <Link href={`/pesanan/${o.id}`} className="font-semibold text-teal-700 hover:underline">
                          {o.code}
                        </Link>{" "}
                        - {o.title} · {formatDateID(o.dueDate)}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <CustomerForm mode="edit" customer={customer} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
