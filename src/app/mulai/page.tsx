import Link from "next/link";
import { ProblemScreen } from "@/components/ProblemScreen";
import { ChecklistToggle } from "@/components/ChecklistToggle";
import { buildChecklist } from "@/lib/checklist";

export const dynamic = "force-dynamic";

export const metadata = { title: "Langkah Selanjutnya — Print Flow" };

export default async function MulaiPage() {
  const state = await buildChecklist();

  if (!state.ready && state.problem) {
    return <ProblemScreen problem={state.problem} hint="Checklist butuh database untuk menilai kondisi aplikasi Anda." />;
  }

  const { items, progress, facts } = state;
  const nextItem = items.find((i) => !i.done && !i.optional);

  return (
    <div className="space-y-4">
      {/* PROGRESS */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-200">Checklist pascapemasangan</p>
          <h1 className="mt-1 text-xl font-extrabold md:text-2xl">
            {progress.percent === 100 ? "🎉 Semua langkah wajib selesai!" : "🚀 Langkah selanjutnya untuk Anda"}
          </h1>
          <p className="mt-1 text-sm text-indigo-100">
            {progress.percent === 100
              ? "Aplikasi sudah siap dipakai penuh. Langkah opsional boleh dikerjakan kapan saja."
              : `Sudah ${progress.done} dari ${progress.total} langkah wajib. ${
                  nextItem ? `Kerjakan langkah ${nextItem.step} sekarang.` : ""
                }`}
          </p>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="mt-1.5 text-xs font-semibold text-indigo-100">{progress.percent}% selesai</p>
        </div>

        <div className="grid grid-cols-2 divide-x divide-slate-100 md:grid-cols-4">
          <Stat label="Pekerjaan nyata" value={String(facts.realOrders)} />
          <Stat label="Data contoh" value={String(facts.demoOrders)} tone={facts.demoOrders > 0 ? "text-amber-600" : "text-emerald-600"} />
          <Stat label="Pekerjaan aktif" value={String(facts.activeCount)} />
          <Stat label="Lewat deadline" value={String(facts.lateCount)} tone={facts.lateCount > 0 ? "text-rose-600" : "text-emerald-600"} />
        </div>
      </div>

      {/* LANGKAH BERIKUTNYA */}
      {nextItem ? (
        <div className="card border-indigo-200 bg-indigo-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
            👉 Kerjakan ini dulu (langkah {nextItem.step})
          </p>
          <p className="mt-1 text-base font-extrabold text-slate-900">{nextItem.title}</p>
          <p className="mt-1 text-sm text-slate-700">{nextItem.why}</p>
          {nextItem.href ? (
            <Link href={nextItem.href} className="btn-primary mt-3">
              {nextItem.cta ?? "Kerjakan sekarang"}
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* DAFTAR LANGKAH */}
      <ol className="space-y-3">
        {items.map((item) => (
          <li key={item.key} className={`card p-4 ${item.done ? "border-emerald-200 bg-emerald-50/40" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                    item.done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {item.done ? "✓" : item.step}
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {item.title}
                    {item.optional ? (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                        opsional
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{item.why}</p>
                </div>
              </div>
              <span className={`chip shrink-0 ${item.done ? "border-emerald-300 bg-emerald-100 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}>
                {item.done ? "✅ " : "⏳ "}
                {item.doneLabel ?? (item.done ? "selesai" : "belum")}
              </span>
            </div>

            <details className="mt-3 group">
              <summary className="cursor-pointer list-none text-xs font-bold text-indigo-600 hover:underline">
                ▸ Lihat cara melakukannya
              </summary>
              <ol className="mt-2 space-y-1.5 border-l-2 border-indigo-100 pl-3">
                {item.how.map((h, i) => (
                  <li key={h} className="text-xs text-slate-600">
                    <strong className="text-slate-800">{i + 1}.</strong> {h}
                  </li>
                ))}
              </ol>
            </details>

            <div className="mt-3 flex flex-wrap gap-2">
              {item.href ? (
                <Link href={item.href} className="btn-ghost">
                  {item.cta ?? "Buka"}
                </Link>
              ) : null}
              {item.manual && item.settingKey ? (
                <ChecklistToggle settingKey={item.settingKey} done={item.done} />
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="card p-4">
        <h3 className="text-sm font-bold text-slate-900">📍 Setelah semua selesai</h3>
        <p className="mt-1 text-sm text-slate-600">
          Rutinitas Anda tinggal: <strong>pagi</strong> baca Ringkasan AI di dashboard (3 menit) →{" "}
          <strong>saat order masuk</strong> klik ➕ Pekerjaan Baru (1 menit) → <strong>saat produksi</strong> klik status
          (5 detik per tahap). Laporan &amp; cadangan cukup sebulan sekali.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/pengaturan" className="btn-ghost">
            ⚙️ Pengaturan &amp; Cadangan
          </Link>
          <Link href="/panduan" className="btn-ghost">
            📘 Panduan &amp; Roadmap
          </Link>
          <Link href="/status" className="btn-ghost">
            🩺 Status Sistem
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "text-slate-900" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-lg font-extrabold ${tone}`}>{value}</p>
    </div>
  );
}
