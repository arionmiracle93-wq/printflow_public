import { notFound } from "next/navigation";
import { CheckCircle2, History, Image as ImageIcon, Lock, PackageCheck, PartyPopper, StickyNote, UserRound, Wrench } from "lucide-react";
import { STATUS_ICONS } from "@/components/ui";
import { safeDb } from "@/lib/dbcheck";
import { getPublicTracking } from "@/lib/queries";
import { STATUSES, customerProgress, formatDateID, formatDateTimeID, formatNumber, statusMeta } from "@/lib/domain";
import { effectiveItemStatus, isSplit } from "@/lib/item-status";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Lacak Pesanan - Print Flow",
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
  // "Siap Diambil/Dikirim" = tahap terakhir yang dilihat pelanggan (progres
  // 100%). Status "Selesai / Diserahkan" baru muncul di sini setelah tim
  // internal benar-benar mengubah statusnya ke Selesai.
  const siap = order.status === "siap";
  const batal = order.status === "batal";
  const progress = customerProgress(order.status);
  // Urutan tahap (tanpa Ditunda/Batal) - dipakai untuk menyalakan chip.
  // Tidak bisa pakai angka progres lagi, karena Siap sekarang 100% di sini
  // dan akan ikut menyalakan chip "Selesai" lebih awal.
  const stageList = STATUSES.filter((s) => !["ditunda", "batal"].includes(s.key));
  const currentStage = stageList.findIndex((s) => s.key === order.status);
  // "Siap Diambil/Dikirim" progress-nya 95% (belum "selesai" 100%), tapi buat
  // pelanggan awam dua-duanya kedengeran sama saja "sudah kelar" - jadi teks
  // deadline/perkiraan selesai disembunyikan mulai status ini, bukan cuma pas
  // sudah benar-benar Selesai.
  const deadlineIrrelevant = selesai || order.status === "siap";

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      {/* HEADER */}
      <div className="card overflow-hidden">
        <div
          className={`px-5 py-5 text-white ${
            selesai || siap
              ? "bg-gradient-to-r from-emerald-500 to-teal-600"
              : batal
                ? "bg-gradient-to-r from-rose-500 to-rose-600"
                : "bg-gradient-to-r from-[#07384f] to-teal-600"
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">Pelacakan Pesanan</p>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold leading-snug">
            {selesai ? (
              <>
                <CheckCircle2 size={20} strokeWidth={2.3} /> Pesanan Anda sudah selesai!
              </>
            ) : siap ? (
              <>
                <PackageCheck size={20} strokeWidth={2.3} /> Pesanan Anda sudah siap!
              </>
            ) : (
              (() => {
                const StatusIcon = STATUS_ICONS[order.status] ?? UserRound;
                return (
                  <>
                    <StatusIcon size={20} strokeWidth={2.3} /> {meta.label}
                  </>
                );
              })()
            )}
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
              <span>{progress}%</span>
            </div>
            <div className="progress-track">
              <div className={`h-full rounded-full ${meta.bar} transition-all`} style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {stageList.map((s, index) => (
                <span
                  key={s.key}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    // Ditunda/Batal tidak ada di daftar tahap -> pakai cara lama (angka progres).
                    (currentStage >= 0 ? index <= currentStage : s.progress <= meta.progress)
                      ? "bg-teal-100 text-teal-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {s.short}
                </span>
              ))}
            </div>
          </div>

          {/* INFO */}
          {/* "Perkiraan selesai" disembunyikan mulai status Siap Diambil/Dikirim
              (bukan cuma pas Selesai) - lihat catatan deadlineIrrelevant di atas. */}
          {/* Rincian pesanan diambil dari daftar item yang diinput operator,
              jadi pelanggan bisa mencocokkan SEMUA barang yang dipesannya -
              bukan cuma satu jenis produk seperti versi sebelumnya. */}
          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Rincian pesanan ({order.items.length} item)
            </p>
            {order.items.length === 0 ? (
              <p className="mt-1 text-sm font-semibold text-slate-800">{order.title}</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {order.items.map((item, index) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-800">
                      <span className="mr-1.5 text-[11px] font-bold text-slate-400">{index + 1}.</span>
                      {item.productType}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {/* Tahap per produk hanya tampil kalau produknya memang
                          dipisah statusnya, supaya pelanggan tahu mana yang
                          sudah jadi dan mana yang masih dikerjakan. */}
                      {isSplit(order.items) ? (
                        <span className={`chip ${statusMeta(effectiveItemStatus(item.status, order.status)).badge}`}>
                          {statusMeta(effectiveItemStatus(item.status, order.status)).short}
                        </span>
                      ) : null}
                      <span className="font-bold text-slate-700">
                        {formatNumber(item.quantity)} {item.unit}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!deadlineIrrelevant ? (
            <Info label="Perkiraan selesai" value={`${formatDateID(order.dueDate)} · ${order.dueTime}`} />
          ) : null}

          {order.notes ? (
            <p className="flex items-start gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <StickyNote size={14} className="mt-0.5 shrink-0" /> {order.notes}
            </p>
          ) : null}

          {siap ? (
            <p className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800">
              <PartyPopper size={16} className="shrink-0" /> Pesanan Anda sudah siap diambil / dikirim. Silakan ikuti informasi pengambilan di bawah ya!
            </p>
          ) : null}

          {selesai ? (
            <p className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800">
              <PartyPopper size={16} className="shrink-0" /> Pesanan Anda sudah selesai dan diserahkan. Terima kasih sudah memesan!
            </p>
          ) : null}
        </div>
      </div>

      {/* INFO PENGAMBILAN - kartu statis (isinya sama untuk semua status),
          sengaja ditaruh selalu tampil (bukan cuma pas status Siap
          Diambil/Kirim) supaya pelanggan sudah tahu prosedur & jam
          operasionalnya dari awal, sebelum pesanannya beneran siap. Kalau
          maunya cuma muncul pas order sudah siap/selesai, tinggal bungkus
          blok ini dengan `{deadlineIrrelevant ? (...) : null}`. */}
      <div className="card space-y-3 p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <PackageCheck size={16} /> Informasi Pengambilan Pesanan
        </h2>

        <div className="flex items-start gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-800">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <p>
            Pesanan dengan status SIAP DIAMBIL / KIRIM berarti sudah jadi, tinggal ambil saja.
          </p>
        </div>

        <div className="space-y-2 text-sm text-slate-700">
          <p>Jika akan pickup langsung, mohon konfirmasi terlebih dahulu.</p>
          <div>
            <p>Jika pengambilan melalui aplikasi kurir/ojek online,</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Mohon kirim bukti pesanan kurir/ojek agar tidak terjadi kesalahan.</li>
              <li className="font-bold">Tanpa bukti pesanan kurir/ojek online tidak bisa kami serahkan ke driver.</li>
            </ul>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          📌 <span className="font-bold">Catatan penting:</span> Barang yang tidak diambil selama{" "}
          <span className="font-bold">1 minggu</span> sejak dinyatakan siap bukan menjadi tanggung jawab toko.
        </div>

        <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          <p className="font-bold text-slate-800">⏰ Jam Operasional</p>
          <ul className="mt-1 space-y-0.5">
            <li>Senin-Jumat : 08:00-22:00 (21:30 Close order)</li>
            <li>Sabtu-Minggu : 09:00-21:00 (20:30 Close order)</li>
          </ul>
          <p className="mt-1.5 text-xs text-slate-500">Pengambilan maksimal 5 menit sebelum jam tutup.</p>
        </div>
      </div>

      {/* FOTO */}
      {order.photos.length > 0 ? (
        <div className="card p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <ImageIcon size={16} /> Foto Pesanan ({order.photos.length})
          </h2>
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
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <History size={16} /> Riwayat Pengerjaan
        </h2>
        <ol className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4">
          {order.timeline.map((e) => {
            const EventIcon = STATUS_ICONS[e.toStatus] ?? UserRound;
            return (
              <li key={`${e.createdAt}-${e.toStatus}`} className="relative">
                <span className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-teal-500" />
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <EventIcon size={13} className="shrink-0" /> {statusMeta(e.toStatus).label}
                </p>
                <p className="text-xs text-slate-500">{formatDateTimeID(e.createdAt)}</p>
                {e.note ? <p className="mt-0.5 text-xs text-slate-600">“{e.note}”</p> : null}
              </li>
            );
          })}
        </ol>
      </div>

      <p className="text-center text-[11px] text-slate-400">
        Halaman ini khusus untuk pesanan {order.code}. Jangan bagikan tautan ke orang lain.
      </p>
    </div>
  );
}

function Info({
  label,
  value,
  tone = "text-slate-800",
  className = "",
}: {
  label: string;
  value: string;
  tone?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-xl bg-slate-50 px-3 py-2 ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function Gagal({ code }: { code: string }) {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <div className="card p-8">
        {code === "salah" ? (
          <Wrench size={44} strokeWidth={1.6} className="mx-auto text-slate-300" />
        ) : (
          <Lock size={44} strokeWidth={1.6} className="mx-auto text-slate-300" />
        )}
        <h1 className="mt-3 text-lg font-semibold text-slate-900">
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
