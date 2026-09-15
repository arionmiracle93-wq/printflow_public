import { SessionsList } from "@/components/SessionsList";
import { ProblemScreen } from "@/components/ProblemScreen";
import { safeDb } from "@/lib/dbcheck";
import { getCurrentUser, listActiveSessions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SesiPage() {
  const me = await getCurrentUser();
  const result = await safeDb(() => listActiveSessions(me?.sessionId ?? 0));
  if (!result.ok) {
    return <ProblemScreen problem={result.problem} hint="Halaman ini membaca daftar sesi aktif dari database." />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 md:text-2xl">📱 Perangkat Aktif</h1>
        <p className="text-sm text-slate-500">
          Semua perangkat yang sedang login, dari semua akun. Logout paksa kalau ada yang mencurigakan atau perangkat hilang.
        </p>
      </div>
      <SessionsList sessions={result.data} />
    </div>
  );
}
