import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing, ChevronLeft, ChevronRight, Download, ReceiptText, Plus, Search, TriangleAlert, Wallet, CircleCheck } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { InvoiceStatusBadge, PayStatusBadge, ProductionMirrorBadge } from "@/components/InvoiceBadges";
import { InvoiceFrame, InvoiceSidebar } from "@/components/InvoiceSidebar";
import { ProblemScreen } from "@/components/ProblemScreen";
import { safeDb } from "@/lib/dbcheck";
import { formatDateID, formatRupiah, jakartaDateISO } from "@/lib/domain";
import { getInvoiceAccess } from "@/lib/invoice-access";
import { bankMatch, dueStatus, onlyDigits, type BankMatch } from "@/lib/invoice-due";
import { DOC_MODES, isDocType, type DocType } from "@/lib/invoice-modes";
import { computePayInfo } from "@/lib/invoice-pay";
import { listInvoices } from "@/lib/invoice-queries";
import { getARSummary } from "@/lib/invoice-reports";
import { getInvoiceSettings } from "@/lib/invoice-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice - Print Flow" };

const PAGE_SIZE = 40;

const FILTERS = [
  { key: "semua", label: "Semua" },
  { key: "belum", label: "Belum bayar" },
  { key: "sebagian", label: "Sebagian" },
  { key: "lewat", label: "Lewat tempo" },
  { key: "lunas", label: "Lunas" },
  { key: "draft", label: "Draft" },
  { key: "batal", label: "Batal" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function filterOf(value: string | undefined): FilterKey {
  return FILTERS.some((f) => f.key === value) ? (value as FilterKey) : "semua";
}

function href(filter: FilterKey, q: string, page: number, m: DocType | "semua", bulan: string) {
  const params = new URLSearchParams();
  if (m !== "semua") params.set("m", m);
  if (filter !== "semua") params.set("f", filter);
  if (q) params.set("q", q);
  if (bulan) params.set("bulan", bulan);
  if (page > 1) params.set("hal", String(page));
  const qs = params.toString();
  return qs ? `/invoice?${qs}` : "/invoice";
}

const MATCH_LABEL: Record<Exclude<BankMatch, null>, string> = {
  nominal: "Cocok nominal",
  kode: "Cocok kode unik",
  akhiran: "Cocok akhiran angka",
};

export default async function InvoiceListPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; q?: string; hal?: string; m?: string; bulan?: string }>;
}) {
  const sp = await searchParams;
  const docType: DocType | "semua" = isDocType(sp.m) ? sp.m : "semua";
  const filter = filterOf(sp.f);
  const q = (sp.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(sp.hal ?? "1", 10) || 1);
  const bulan = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.bulan ?? "") ? (sp.bulan as string) : "";

  const loaded = await safeDb(async () => {
    const access = await getInvoiceAccess();
    if (!access) return null;
    const settings = await getInvoiceSettings();
    const [list, ar] = await Promise.all([
      listInvoices({
        docType: docType === "semua" ? undefined : docType,
        status: filter === "draft" || filter === "batal" ? filter : undefined,
        payStatus: filter === "belum" || filter === "sebagian" || filter === "lunas" ? filter : undefined,
        due: filter === "lewat" ? "lewat" : undefined,
        month: bulan || undefined,
        uniqueCode: settings.uniqueCode,
        q,
        limit: PAGE_SIZE + 1,
        offset: (page - 1) * PAGE_SIZE,
      }),
      getARSummary(),
    ]);
    return { access, list, settings, ar };
  });
  if (!loaded.ok) return <ProblemScreen problem={loaded.problem} hint="Data invoice disimpan di database." />;
  if (!loaded.data) redirect("/tidak-diizinkan");

  const { access, list, settings, ar } = loaded.data;
  const today = jakartaDateISO();
  const hasNext = list.rows.length > PAGE_SIZE;
  const rows = list.rows.slice(0, PAGE_SIZE);
  const digits = onlyDigits(q);
  const mode = docType === "semua" ? DOC_MODES.invoice : DOC_MODES[docType];
  const isInvoiceView = docType === "invoice" || docType === "semua";
  const chips = isInvoiceView ? FILTERS : FILTERS.filter((f) => ["semua", "draft", "batal"].includes(f.key));
  const newHref = `/invoice/baru${docType !== "semua" && docType !== "invoice" ? `?m=${docType}` : ""}`;
  const exportHref = `/api/invoices/export${bulan ? `?bulan=${bulan}` : ""}`;

  return (
    <InvoiceFrame
      sidebar={<InvoiceSidebar businessName={settings.businessName} isOwner={access.isOwner} docType={docType} modeBehavior="filter" />}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <ReceiptText size={22} strokeWidth={2.3} /> {docType === "semua" ? "Riwayat Dokumen" : `Riwayat ${mode.label}`}
            </h1>
            <p className="text-sm text-slate-500">{isInvoiceView ? "Pantau tagihan, cocokkan mutasi bank, dan tagih yang belum bayar." : mode.hint}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isInvoiceView ? (
              <a href={exportHref} className="btn-ghost px-3 py-2 text-xs" title={bulan ? `Export rekap ${bulan}` : "Export rekap semua Invoice"}>
                <Download size={14} /> Export CSV
              </a>
            ) : null}
            <Link href={newHref} className="btn-primary">
              <Plus size={15} /> {mode.newBtn}
            </Link>
          </div>
        </div>

        {isInvoiceView ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="card p-3">
              <p className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wider text-amber-700"><Wallet size={13} /> Belum dibayar</p>
              <p className="mt-0.5 text-lg font-extrabold text-[color:var(--pf-ink)]">{formatRupiah(ar.due)}</p>
              <p className="text-[11px] text-slate-500">{ar.dueCount} invoice</p>
            </div>
            <Link href={href("lewat", "", 1, docType, "")} className="card p-3 transition hover:-translate-y-0.5">
              <p className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wider text-rose-700"><TriangleAlert size={13} /> Lewat tempo</p>
              <p className="mt-0.5 text-lg font-extrabold text-rose-600">{formatRupiah(ar.late)}</p>
              <p className="text-[11px] text-slate-500">{ar.lateCount} invoice · klik untuk melihat</p>
            </Link>
            <div className="card p-3">
              <p className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-700"><CircleCheck size={13} /> Sudah dibayar</p>
              <p className="mt-0.5 text-lg font-extrabold text-emerald-700">{formatRupiah(ar.paid)}</p>
              <p className="text-[11px] text-slate-500">dari semua invoice terbit</p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {chips.map((f) => (
            <Link
              key={f.key}
              href={href(f.key, q, 1, docType, bulan)}
              className={`chip px-3 py-1.5 text-xs font-semibold ${
                filter === f.key ? "border-teal-500 bg-teal-500 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <form action="/invoice" method="get" className="space-y-2">
          {filter !== "semua" ? <input type="hidden" name="f" value={filter} /> : null}
          {docType !== "semua" ? <input type="hidden" name="m" value={docType} /> : null}
          <div className="flex flex-wrap gap-2">
            <label className="relative min-w-0 flex-[2_1_220px]">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input name="q" defaultValue={q} placeholder="Cari nomor, nama, atau nominal transfer" className="input w-full pl-9" />
            </label>
            <label className="min-w-0 flex-[1_1_150px]">
              <span className="sr-only">Bulan</span>
              <input type="month" name="bulan" defaultValue={bulan} className="input w-full" aria-label="Filter bulan" />
            </label>
            <button className="btn-secondary px-4">Cari</button>
            {q || bulan ? (
              <Link href={href(filter, "", 1, docType, "")} className="btn-ghost px-3">Reset</Link>
            ) : null}
          </div>
          <p className="text-[11px] text-slate-400">
            Cocokkan mutasi bank: ketik nominal penuh, 3 digit terakhir (kode unik), atau akhiran angka (minimal 4 digit).
          </p>
        </form>

        {rows.length === 0 ? (
          <EmptyState
            icon={<ReceiptText size={26} />}
            title={q || bulan || filter !== "semua" ? "Tidak ada dokumen yang cocok" : "Belum ada dokumen"}
            description={
              q || bulan || filter !== "semua"
                ? q
                  ? `Tidak ada yang cocok dengan "${q}". Coba nominal penuh, 3 digit kode unik, atau nama pelanggan.`
                  : "Coba ganti filter atau bulan."
                : "Buat dokumen pertama: isi item di tabel, isi customer, lalu terbitkan. Nomor resminya keluar otomatis."
            }
            action={{ href: newHref, label: mode.newBtn, icon: <Plus size={15} /> }}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => {
              const rowMode = DOC_MODES[isDocType(row.docType) ? row.docType : "invoice"];
              const isInv = row.docType === "invoice";
              const remaining = Math.max(0, row.total - row.paidAmount);
              const unpaid = isInv && row.status === "terbit" && row.payStatus !== "lunas";
              const pay = computePayInfo({ total: row.total, paid: row.paidAmount, method: row.payMethod, number: row.number, uniqueCodeEnabled: settings.uniqueCode });
              const st = unpaid ? dueStatus(row.dueDate, false, today) : null;
              const match = isInv && digits ? bankMatch(digits, { total: row.total, payable: pay.payable, code: pay.code }) : null;
              return (
                <div key={row.id} className={`card flex flex-col p-4 ${match === "nominal" ? "ring-2 ring-emerald-400" : ""}`}>
                  <Link href={`/invoice/${row.id}`} className="block flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[color:var(--pf-ink)]">{row.number ?? `Draft #${row.id}`}</p>
                        <p className="truncate text-xs text-slate-500">{row.customerName}</p>
                      </div>
                      {rowMode.showTotals ? <p className="shrink-0 text-sm font-bold text-[color:var(--pf-ink)]">{formatRupiah(row.total)}</p> : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={`chip ${rowMode.badge}`}>{rowMode.label}</span>
                      <InvoiceStatusBadge status={row.status} />
                      {rowMode.hasPayments ? <PayStatusBadge payStatus={row.payStatus} status={row.status} /> : null}
                      {st && (st.kind === "late" || st.kind === "today") ? (
                        <span className="chip border-rose-200 bg-rose-50 text-rose-700">{st.label.toUpperCase()}</span>
                      ) : st && st.kind === "soon" ? (
                        <span className="chip border-amber-200 bg-amber-50 text-amber-700">{st.label}</span>
                      ) : null}
                      {match ? <span className="chip border-emerald-300 bg-emerald-50 text-emerald-700">{MATCH_LABEL[match]}</span> : null}
                      <ProductionMirrorBadge status={row.orderStatus} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500">
                      <span>
                        {formatDateID(row.issueDate)}
                        {rowMode.hasPayments && row.dueDate && unpaid ? ` · jatuh tempo ${formatDateID(row.dueDate)}` : ""}
                      </span>
                      {unpaid ? <span className="font-semibold text-rose-600">Sisa {formatRupiah(remaining)}</span> : null}
                    </div>
                    {isInv && row.status === "terbit" && row.paidAmount > 0 && row.payStatus !== "lunas" ? (
                      <p className="mt-1 text-[11px] text-slate-500">Sudah dibayar {formatRupiah(row.paidAmount)}</p>
                    ) : null}
                    {unpaid && row.payMethod === "Transfer" && pay.code > 0 ? (
                      <p className="mt-1 text-[11px] font-semibold text-teal-700">Transfer {formatRupiah(pay.payable)} <span className="font-normal text-slate-400">(kode unik {pay.code})</span></p>
                    ) : null}
                    {row.orderCode ? <p className="mt-1 text-[11px] text-slate-400">Pekerjaan {row.orderCode}</p> : null}
                  </Link>
                  {unpaid ? (
                    <Link href={`/invoice/${row.id}?tagih=1`} className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
                      <BellRing size={13} /> Tagih lewat WhatsApp
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {page > 1 || hasNext ? (
          <div className="flex items-center justify-between gap-2">
            {page > 1 ? (
              <Link href={href(filter, q, page - 1, docType, bulan)} className="btn-ghost px-3 py-2 text-xs">
                <ChevronLeft size={14} /> Sebelumnya
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-slate-400">Halaman {page}</span>
            {hasNext ? (
              <Link href={href(filter, q, page + 1, docType, bulan)} className="btn-ghost px-3 py-2 text-xs">
                Berikutnya <ChevronRight size={14} />
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </div>
    </InvoiceFrame>
  );
}
