import { BellRing, Info } from "lucide-react";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifikasi Perangkat — Print Flow" };

export default async function NotificationPage() {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-teal-600">Perangkat {user?.name}</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-[#07384f]"><BellRing size={24} /> Notifikasi Perangkat</h1>
        <p className="mt-1 text-sm text-slate-500">Aktifkan sekali pada setiap HP/komputer yang perlu menerima pembaruan Print Flow.</p>
      </div>
      <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs leading-relaxed text-sky-800">
        <Info size={14} className="mr-1 inline" /> Subscription terhubung ke akun <strong>{user?.name}</strong>. Mutasi shift ditujukan kepada Karyawan terkait dan Owner; status umum dikirim ke perangkat internal aktif.
      </div>
      <PushNotificationSettings />
    </div>
  );
}
