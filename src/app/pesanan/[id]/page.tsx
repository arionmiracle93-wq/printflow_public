import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderQuickEdit, OrderStatusControls } from "@/components/OrderControls";
import { PhotoManager } from "@/components/PhotoManager";
import { ShareWhatsApp } from "@/components/ShareWhatsApp";
import { OutsourceManager } from "@/components/OutsourceManager";
import { HandoverManager } from "@/components/HandoverManager";
import { listHandovers } from "@/lib/handover-queries";
import { ProblemScreen } from "@/components/ProblemScreen";
import { getOutsource, listPartners } from "@/lib/outsource-queries";
import { outsourceStatusMeta } from "@/lib/outsource";
import { getCurrentUser } from "@/lib/auth";
import { listActiveEmployees } from "@/lib/user-queries";
import { safeDb } from "@/lib/dbcheck";
import type { AiOrder } from "@/lib/ai";
import { MAX_PHOTOS_PER_ORDER, listPhotos } from "@/lib/queries";
import { PriorityBadge, ProgressBar, RiskBadge, StatusBadge } from "@/components/ui";
import { analyzeOrder } from "@/lib/ai";
import {
  MACHINES,
  STATUSES,
  deadlineOf,
  formatDateID,
  formatDateTimeID,
  formatNumber,
  formatRupiah,
  humanDuration,
  statusMeta,
} from "@/lib/domain";
import { getAiNotes, getOrderById, getOrderEvents } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number.parseInt(id, 10);
  if (!Number.isFinite(orderId)) notFound();

  const loaded = await safeDb(async () => {
    const [order, sessionUser] = await Promise.all([getOrderById(orderId), getCurrentUser()]);
    if (!order) return null;
    const [events, notes, photos, outsource, partners, handovers, employees] = await Promise.all([
      getOrderEvents(orderId),
      getAiNotes(orderId),
      listPhotos(orderId),
      getOutsource(orderId),
      listPartners(),
      listHandovers(orderId),
      listActiveEmployees(sessionUser?.role === "karyawan" ? sessionUser.id : undefined),
    ]);
    return { order, events, notes, photos, outsource, partners, handovers, sessionUser, employees };
  });
  if (!loaded.ok) {
    // Tabel foto mungkin belum ada (deploy lama). Coba tanpa foto agar halaman tetap terbuka.
    const fallback = await safeDb(async () => {
      const order = await getOrderById(orderId);
      if (!order) return null;
      const [events, notes] = await Promise.all([getOrderEvents(orderId), getAiNotes(orderId)]);
      return { order, events, notes, photos: [], photosUnavailable: true };
    });
    if (!fallback.ok) {
      return <ProblemScreen problem={loaded.problem} hint="Detail pekerjaan dibaca dari database." />;
    }
    if (!fallback.data) notFound();
    const order = fallback.data.order;
    const insight = analyzeOrder(order);
    const meta = statusMeta(order.status);
    return (
      <div className="space-y-4">
        <UpgradeNotice />
        <DetailBody order={order} events={fallback.data.events} notes={fallback.data.notes} insight={insight} meta={meta} />
      </div>
    );
  }
  if (!loaded.data) notFound();

  const order = loaded.data.order;
  const events = loaded.data.events;
  const notes = loaded.data.notes;
  const photos = loaded.data.photos;
  const insight = analyzeOrder(order);
  const meta = statusMeta(order.status);

  return (
    <div className="space-y-4">
      <DetailBody order={order} events={events} notes={notes} insight={insight} meta={meta} outsourceStatus={loaded.data.outsource?.status ?? null} />
      <HandoverManager
        orderId={order.id}
        currentOperator={order.operator}
        orderStatus={order.status}
        records={loaded.data.handovers}
        loggedInName={loaded.data.sessionUser?.name ?? "Pengguna"}
        loggedInRole={loaded.data.sessionUser?.role ?? "karyawan"}
        employees={loaded.data.employees}
      />
      <OutsourceManager
        orderId={order.id}
        orderPrice={order.price}
        customerDueDate={order.dueDate}
        current={loaded.data.outsource}
        initialPartners={loaded.data.partners.map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          phone: p.phone,
          address: p.address,
          active: p.active,
        }))}
      />
      <ShareWhatsApp
        order={{
          id: order.id,
          code: order.code,
          title: order.title,
          customerName: order.customerName,
          status: order.status,
          dueDate: order.dueDate,
          dueTime: order.dueTime,
        }}
        initialToken={null}
      />
      <PhotoManager
        orderId={order.id}
        max={MAX_PHOTOS_PER_ORDER}
        initialPhotos={photos.map((p) => ({
          id: p.id,
          kind: p.kind,
          caption: p.caption,
          sizeBytes: p.sizeBytes,
          url: p.url,
          createdAt: p.createdAt,
        }))}
      />
    </div>
  );
}

/** Kartu peringatan bila tabel foto belum dibuat di database pengguna. */
function UpgradeNotice() {
  return (
    <div className="card border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-bold text-amber-900">🖼️ Fitur foto siap dipakai — satu langkah lagi</p>
      <p className="mt-1 text-xs text-amber-800">
        Tabel penyimpan foto belum ada di database Anda. Buka alamat ini sekali di browser, lalu kembali ke halaman ini:
      </p>
      <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-amber-900">
        https://alamat-aplikasi-anda.vercel.app/api/setup
      </p>
      <p className="mt-1 text-[11px] text-amber-700">
        Aman dijalankan berulang — tidak menghapus data apa pun.
      </p>
    </div>
  );
}

function DetailBody({
  order,
  events,
  notes,
  insight,
  meta,
  outsourceStatus = null,
}: {
  order: AiOrder;
  events: Awaited<ReturnType<typeof getOrderEvents>>;
  notes: Awaited<ReturnType<typeof getAiNotes>>;
  insight: ReturnType<typeof analyzeOrder>;
  meta: ReturnType<typeof statusMeta>;
  outsourceStatus?: string | null;
}) {
  const deadline = deadlineOf(order.dueDate, order.dueTime);
  const hoursLeft = (deadline.getTime() - Date.now()) / 3_600_000;
  const outstanding = Math.max(0, order.price - order.paidAmount);

  return (
    <div className="space-y-4">
      <Link href="/pesanan" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline">
        ← Kembali ke daftar pekerjaan
      </Link>

      {/* HEADER */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-wide text-indigo-600">{order.code}</p>
            <h1 className="text-xl font-extrabold text-slate-900 md:text-2xl">{order.title}</h1>
            <p className="text-sm text-slate-600">
              {order.customerName} · dibuat {formatDateTimeID(order.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} />
            <PriorityBadge priority={order.priority} />
            <RiskBadge level={insight.riskLevel} score={insight.riskScore} />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Jenis / Jumlah" value={`${order.productType} · ${formatNumber(order.quantity)} ${order.unit}`} />
          <Info label="Mesin / Operator" value={`${order.machine}${order.operator ? ` · ${order.operator}` : ""}`} />
          <Info label="Deadline" value={`${formatDateID(order.dueDate)} · ${order.dueTime}`} />
          <Info
            label="Sisa waktu"
            value={
              hoursLeft < 0 && !meta.done
                ? `⚠️ Terlambat ${humanDuration(hoursLeft)}`
                : meta.done
                  ? "Selesai"
                  : humanDuration(hoursLeft)
            }
          />
          <Info label="Total harga" value={formatRupiah(order.price)} />
          <Info label="Sudah dibayar" value={formatRupiah(order.paidAmount)} />
          <Info label="Sisa tagihan" value={formatRupiah(outstanding)} tone={outstanding > 0 ? "text-rose-600" : "text-emerald-600"} />
          <Info label="Estimasi kerja (AI)" value={`± ${order.estHours} jam`} />
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Progres produksi</span>
            <span>{meta.progress}%</span>
          </div>
          <ProgressBar value={meta.progress} tone={meta.bar} />
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

        {order.notes ? (
          <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">📝 {order.notes}</p>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* AI ANALYSIS */}
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white">
            <p className="text-sm font-bold">🤖 Analisa AI untuk pekerjaan ini</p>
            <p className="text-[11px] text-indigo-100">Dihitung dari sisa pekerjaan vs sisa waktu &amp; prioritas</p>
          </div>
          <div className="space-y-3 p-4">
            <p className="text-sm font-semibold text-slate-800">{insight.headline}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Skor risiko</span>
              <div className="flex-1">
                <ProgressBar
                  value={insight.riskScore}
                  tone={
                    insight.riskLevel === "terlambat"
                      ? "bg-rose-500"
                      : insight.riskLevel === "risiko"
                        ? "bg-orange-500"
                        : insight.riskLevel === "waspada"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                  }
                />
              </div>
              <span className="text-xs font-bold text-slate-700">{insight.riskScore}/100</span>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Kenapa begitu?</p>
              <ul className="mt-1 space-y-1 text-xs text-slate-600">
                {insight.reasons.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Saran tindakan</p>
              <ul className="mt-1 space-y-1 text-xs text-slate-700">
                {insight.recommendations.map((r) => (
                  <li key={r} className="flex gap-1.5">
                    <span className="text-indigo-500">→</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
            {notes.length ? (
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Riwayat catatan AI</p>
                <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600">
                  {notes.slice(0, 5).map((n) => (
                    <li key={n.id}>
                      {formatDateTimeID(n.createdAt)} — {n.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        {/* CONTROLS */}
        <div className="space-y-4">
          <OrderStatusControls orderId={order.id} currentStatus={order.status} outsourceStatus={outsourceStatus} />
          <OrderQuickEdit
            order={{
              id: order.id,
              dueDate: order.dueDate,
              dueTime: order.dueTime,
              priority: order.priority,
              operator: order.operator,
              machine: MACHINES.includes(order.machine) ? order.machine : MACHINES[0],
              price: order.price,
              paidAmount: order.paidAmount,
              notes: order.notes,
            }}
          />
        </div>
      </div>

      {/* TIMELINE */}
      <div className="card p-4">
        <h3 className="text-sm font-bold text-slate-900">🕘 Riwayat / Jejak Produksi</h3>
        <p className="text-xs text-slate-500">Siapa mengubah apa dan kapan — berguna saat ada keluhan pelanggan.</p>
        <ol className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4">
          {events.length === 0 ? (
            <li className="text-sm text-slate-500">Belum ada riwayat.</li>
          ) : (
            events.map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-indigo-500" />
                <p className="text-sm font-semibold text-slate-800">
                  {event.fromStatus ? `${eventStatusLabel(event.fromStatus)} → ` : ""}
                  {event.toStatus.startsWith("mitra:") ? "🏭 " : statusMeta(event.toStatus).emoji + " "}
                  {eventStatusLabel(event.toStatus)}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDateTimeID(event.createdAt)} · oleh {event.actor}
                </p>
                {event.note ? <p className="mt-0.5 text-xs text-slate-600">“{event.note}”</p> : null}
              </li>
            ))
          )}
        </ol>
      </div>
    </div>
  );
}

function eventStatusLabel(value: string): string {
  if (value.startsWith("mitra:")) return `Mitra — ${outsourceStatusMeta(value.slice(6)).label}`;
  if (value === "shift:menunggu") return "Serah Terima — Menunggu Diterima";
  if (value === "shift:diterima") return "Serah Terima — Sudah Diterima";
  if (value === "shift:aktif") return "Operator Aktif";
  return statusMeta(value).label;
}

function Info({ label, value, tone = "text-slate-800" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
