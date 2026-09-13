import { notFound } from "next/navigation";
import { safeDb } from "@/lib/dbcheck";
import { getPublicTracking } from "@/lib/queries";
import { STATUSES, formatDateID, formatDateTimeID, formatNumber, statusMeta } from "@/lib/domain";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Lacak Pesanan — Print Flow",
  robots: { index: false, follow: false },
};

export default async function LacakPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const loaded = await safeDb(() => getPublicTracking(token));
  if (!loaded.ok) {
    return <Gagal code="salah" />;
  }
  const order = loaded.data;
  if (!order) {
    return <Gagal code="tidak-ada" />;
  }

  const meta = statusMeta(order.status);
  const selesai = order.status === "selesai";
  const batal = order.status === "batal";

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      {/* HEADER */}
      <div className="card overflow-hidden">
        <div
          className={`px-5 py-5 text-white ${
            selesai
              ? "bg-gradient-to-r from-emerald-500 to-teal-600"
              : batal
                ? "bg-gradient-to-r from-rose-500 to-rose-600"
                : "bg-gradient-to-r from-indigo-600 to-violet-600"
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">Pelacakan Pesanan</p>
          <h1 className="mt-1 text-xl font-extrabold leading-snug">
            {selesai ? "✅ Pesanan Anda sudah selesai!" : `${meta.emoji} ${meta.label}`}
          </h1>
          <p className="mt-1 text-sm text-white/85">{order.title}</p>
          <p className="mt-0.5 text-xs font-semibold text-white/70">
            No. pesanan: {order.code}
          </p>
        </div>

        <div className="space-y-4 p-5">
          {/* PROGRESS */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Progres pengerjaan</span>
              <span>{meta.progress}%</span>
            </div>
            <div className="progress-track">
              <div className={`h-full rounded-full ${meta.bar} transition-all`} style={{ width: `${meta.progress}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {STATUSES.filter((s) => !["ditunda", "batal"].includes(s.key)).map((s) => (
                <span
                  key={s.key}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    s.progress <= meta.progress ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {s.short}
                </span>
              ))}
            </div>
          </div>

          {/* INFO */}
          <div className="grid gap-2 sm:grid-cols-2">
            <Info label="Jenis pesanan" value={`${order.productType} · ${formatNumber(order.quantity)} ${order.unit}`} />
            <Info
              label="Perkiraan selesai"
              value={`${formatDateID(order.dueDate)} · ${order.dueTime}`}
              tone={selesai ? "text-emerald-600" : "text-slate-800"}
            />
          </div>

          {order.notes ? (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">📝 {order.notes}</p>
          ) : null}

          {selesai ? (
            <p className="rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800">
              🎉 Pesanan Anda sudah bisa diambil / dikirim. Terima kasih sudah memesan!
            </p>
          ) : null}
        </div>
      </div>

      {/* FOTO */}
      {order.photos.length > 0 ? (
        <div className="card p-4">
          <h2 className="text-sm font-bold text-slate-900">🖼️ Foto Pesanan ({order.photos.length})</h2>
          <p className="text-xs text-slate-500">Ketuk foto untuk memperbesar.</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {order.photos.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="overflow-hidden rounded-xl border border-slate-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? "Foto pesanan"} className="h-32 w-full object-cover" loading="lazy" />
                <p className="p-2 text-[11px] font-semibold text-slate-600">{p.caption ?? "Lihat foto"}</p>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {/* RIWAYAT */}
      <div className="card p-4">
        <h2 className="text-sm font-bold text-slate-900">🕘 Riwayat Pengerjaan</h2>
        <ol className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4">
          {order.timeline.map((e) => (
            <li key={`${e.createdAt}-${e.toStatus}`} className="relative">
              <span className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-indigo-500" />
              <p className="text-sm font-semibold text-slate-800">
                {statusMeta(e.toStatus).emoji} {statusMeta(e.toStatus).label}
              </p>
              <p className="text-xs text-slate-500">{formatDateTimeID(e.createdAt)}</p>
              {e.note ? <p className="mt-0.5 text-xs text-slate-600">“{e.note}”</p> : null}
            </li>
          ))}
        </ol>
      </div>

      <p className="text-center text-[11px] text-slate-400">
        Halaman ini khusus untuk pesanan {order.code}. Jangan bagikan tautan ke orang lain.
      </p>
    </div>
  );
}

function Info({ label, value, tone = "text-slate-800" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function Gagal({ code }: { code: string }) {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <div className="card p-8">
        <p className="text-5xl">{code === "salah" ? "🛠️" : "🔒"}</p>
        <h1 className="mt-3 text-lg font-extrabold text-slate-900">
          {code === "salah" ? "Sistem sedang tidak bisa menampilkan data" : "Tautan tidak dikenali"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          {code === "salah"
            ? "Coba muat ulang halaman ini. Jika masih gagal, silakan hubungi kami lewat WhatsApp."
            : "Tautan pelacakan salah ketik atau sudah tidak berlaku. Silakan minta tautan terbaru kepada kami."}
        </p>
      </div>
    </div>
  );
}
