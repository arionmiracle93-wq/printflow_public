import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { CheckCircle2, History, Image as ImageIcon, Lock, PackageCheck, PartyPopper, StickyNote, UserRound, Wrench } from "lucide-react";
import { STATUS_ICONS } from "@/components/ui";
import { db } from "@/db";
import { businessBranding } from "@/db/schema";
import { safeDb } from "@/lib/dbcheck";
import { getPublicTracking } from "@/lib/queries";
import { STATUSES, customerProgress, formatDateID, formatDateTimeID, formatNumber, statusMeta } from "@/lib/domain";
import { effectiveItemStatus, isSplit } from "@/lib/item-status";
import { DEFAULT_INVOICE_SETTINGS, getInvoiceSettings } from "@/lib/invoice-settings";

export const dynamic = "force-dynamic";

type TrackingBrand = {
  /** Nama usaha yang sudah diisi owner. Null = masih placeholder/kosong. */
  name: string | null;
  /** Logo usaha dari tabel branding; null = belum diunggah. */
  logo: { url: string; type: string; previewUrl: string } | null;
};

/**
 * Identitas yang dipakai untuk kartu pratinjau WhatsApp halaman lacak.
 *
 * WhatsApp mengambil judul/deskripsi dari metadata halaman dan ikon kecil dari
 * favicon halaman. Jadi jangan warisi identitas aplikasi dari layout root:
 * pakai nama usaha + logo yang sudah diatur owner di halaman Pengaturan.
 */
const getTrackingBrand = cache(async (): Promise<TrackingBrand> => {
  const [settings, logo] = await Promise.all([
    getInvoiceSettings().catch(() => DEFAULT_INVOICE_SETTINGS),
    (async () => {
      try {
        const rows = await db
          .select({ mime: businessBranding.mime, updatedAt: businessBranding.updatedAt })
          .from(businessBranding)
          .where(eq(businessBranding.id, 1))
          .limit(1);
        const row = rows[0];
        if (!row) return null;
        const version = new Date(row.updatedAt).getTime();
        return {
          // Versi di URL ikut berubah saat logo diganti, supaya WhatsApp/browser
          // tidak terus memakai gambar lama dari cache.
          url: `/api/branding/logo?v=${Number.isFinite(version) ? version : 0}`,
          type: row.mime,
          // Versi khusus kartu pratinjau WhatsApp (persegi, ringan).
          previewUrl: `/api/branding/preview?v=${Number.isFinite(version) ? version : 0}&s=200`,
        };
      } catch {
        // Database lama/belum siap tidak boleh membuat halaman lacak gagal dibuka.
        return null;
      }
    })(),
  ]);

  const name = settings.businessName.trim();
  return {
    name: name && name !== DEFAULT_INVOICE_SETTINGS.businessName ? name : null,
    logo,
  };
});

/**
 * Alamat situs yang sedang diakses (https://domain-anda). WhatsApp hanya mau
 * menampilkan gambar pratinjau kalau alamatnya LENGKAP (https://...), jadi
 * alamat gambar harus dibangun dari domain yang benar-benar dipakai pelanggan -
 * otomatis ikut kalau nanti pakai custom domain.
 */
async function currentOrigin(): Promise<string | null> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return null;
    const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const [brand, origin] = await Promise.all([getTrackingBrand(), currentOrigin()]);
  // Judul tab browser tetap "Lacak Pesanan - Nama Usaha".
  const title = brand.name ? `Lacak Pesanan - ${brand.name}` : "Lacak Pesanan";
  const description = "Pantau progres dan foto pesanan Anda.";
  // Judul di kartu pratinjau WhatsApp = NAMA USAHA saja (baris tebal paling
  // atas kartu). Sebelumnya baris ini berisi alamat domain aplikasi.
  const shareTitle = brand.name ?? "Lacak Pesanan";

  return {
    title,
    description,
    // Tanpa ini alamat gambar pratinjau tidak bisa dibuat lengkap.
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    applicationName: brand.name ?? undefined,
    // Halaman pelanggan tidak perlu manifest PWA aplikasi internal. Ini juga
    // mencegah nama/ikon "Print Flow" terbaca dari manifest saat tautan dibuka.
    manifest: null,
    // Kalau pelanggan menyimpan tautan ini ke layar utama iPhone, judulnya
    // ikut nama usaha - bukan nama aplikasi.
    appleWebApp: brand.name
      ? { capable: true, title: brand.name, statusBarStyle: "black-translucent" }
      : undefined,
    robots: { index: false, follow: false },
    openGraph: {
      title: shareTitle,
      description,
      siteName: brand.name ?? undefined,
      type: "website",
      // Logo usaha sebagai gambar kartu WhatsApp (kotak persegi KECIL 200 px ->
      // tampil sebagai thumbnail di samping nama usaha, bukan banner besar).
      // Pakai route khusus yang merapikan logo (latar putih, 200x200, ringan) karena WhatsApp
      // menolak gambar besar (> ~300 KB) dan tidak selalu bisa membaca WEBP.
      ...(brand.logo
        ? {
            images: [
              {
                url: brand.logo.previewUrl,
                width: 200,
                height: 200,
                type: "image/jpeg",
                alt: brand.name ? `Logo ${brand.name}` : "Logo usaha",
              },
            ],
          }
        : {}),
    },
    // Kalau logo belum ada, jangan tulis `icons` supaya ikon bawaan layout
    // tetap dipakai sebagai fallback. Kalau ada, favicon halaman lacak
    // sepenuhnya memakai logo usaha (bukan ikon printer aplikasi).
    ...(brand.logo
      ? {
          icons: {
            icon: [{ url: brand.logo.url, type: brand.logo.type, sizes: "512x512" }],
            apple: [{ url: brand.logo.url, type: brand.logo.type, sizes: "512x512" }],
          },
        }
      : {}),
  };
}

export default async function LacakPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const [loaded, brand] = await Promise.all([safeDb(() => getPublicTracking(token)), getTrackingBrand()]);
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
      {/* HEADER — header/footer aplikasi disembunyikan oleh layout, jadi
          identitas yang dilihat pelanggan hanya logo + nama usaha. Keduanya
          ditaruh di sudut kanan atas kartu status (bukan lagi di atas kartu). */}
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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-white/70">Pelacakan Pesanan</p>
              <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold leading-snug">
                {selesai ? (
                  <>
                    <CheckCircle2 size={20} strokeWidth={2.3} className="shrink-0" /> Pesanan Anda sudah selesai!
                  </>
                ) : siap ? (
                  <>
                    <PackageCheck size={20} strokeWidth={2.3} className="shrink-0" /> Pesanan Anda sudah siap!
                  </>
                ) : (
                  (() => {
                    const StatusIcon = STATUS_ICONS[order.status] ?? UserRound;
                    return (
                      <>
                        <StatusIcon size={20} strokeWidth={2.3} className="shrink-0" /> {meta.label}
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

            {/* IDENTITAS USAHA — pojok kanan atas. Logo ditaruh di kotak putih
                supaya tetap jelas di atas warna header apa pun (biru, hijau,
                merah). Kalau hanya salah satu (logo / nama) yang sudah diisi
                owner, yang lain tidak ditampilkan. */}
            {brand.name || brand.logo ? (
              <div
                className={`flex w-[84px] shrink-0 flex-col gap-1 sm:w-[108px] ${
                  brand.logo ? "items-center text-center" : "items-end text-right"
                }`}
              >
                {brand.logo ? (
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1.5 shadow-md ring-1 ring-white/40 sm:h-14 sm:w-14">
                    {/* eslint-disable-next-line @next/next/no-img-element -- logo from a dynamic API route, cached by the browser */}
                    <img
                      src={brand.logo.url}
                      alt={brand.name ? `Logo ${brand.name}` : "Logo usaha"}
                      className="max-h-full max-w-full object-contain"
                    />
                  </span>
                ) : null}
                {brand.name ? (
                  <p className="line-clamp-2 break-words text-[10px] font-bold leading-tight text-white/90 sm:text-[11px]">
                    {brand.name}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
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
