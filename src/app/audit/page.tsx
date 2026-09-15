import { AuditTimeline } from "@/components/AuditTimeline";
import { ProblemScreen } from "@/components/ProblemScreen";
import { safeDb } from "@/lib/dbcheck";
import { listAuditEntries } from "@/lib/audit-queries";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const result = await safeDb(() => listAuditEntries());
  if (!result.ok) {
    return <ProblemScreen problem={result.problem} hint="Halaman audit membaca riwayat login, status, mutasi, dan foto dari database." />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 md:text-2xl">🕵️ Audit Aktivitas</h1>
        <p className="text-sm text-slate-500">
          Riwayat login, perubahan status, mutasi kerjaan, dan upload foto — digabung per akun.
        </p>
      </div>
      <AuditTimeline entries={result.data} />
    </div>
  );
}
