import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  Download,
  Layers,
  PencilLine,
  PieChart,
  Plus,
  ReceiptText,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { InvoiceHistoryList } from "@/components/InvoiceHistoryList";
import { InvoiceFrame, InvoiceSidebar, SideButton } from "@/components/InvoiceSidebar";
import { ProblemScreen } from "@/components/ProblemScreen";
import { StatusFilterDropdown } from "@/components/StatusFilterDropdown";
import { PeriodeTanggalChip } from "@/components/PeriodeTanggalChip";
import { KpiCard } from "@/components/ui";
import { safeDb } from "@/lib/dbcheck";
import { formatRupiah, jakartaDateISO } from "@/lib/domain";
import { getInvoiceAccess } from "@/lib/invoice-access";
import { DOC_MODES, isDocType, type DocType } from "@/lib/invoice-modes";
import { LIST_PRESETS, listPeriodQuery, resolveListPeriod } from "@/lib/invoice-period";
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

/* Ikon per filter, dipisah dari FILTERS supaya daftar itu tetap bisa
   ditulis `as const` (kuncinya dipakai sebagai tipe FilterKey) tanpa
   ikut membawa elemen React ke dalam tipe.

   Ikon bukan hiasan: "Draft" dan "Batal" sama-sama dokumen yang belum
   berlaku, tapi bentuk ikonnya jauh berbeda, jadi keduanya tidak bisa
   tertukar walau tidak terbaca. */
const FILTER_ICONS: Record<FilterKey, ReactNode> = {
  semua: <Layers size={15} />,
  belum: <Wallet size={15} />,
  sebagian: <PieChart size={15} />,
  lewat: <TriangleAlert size={15} />,
  lunas: <CircleCheck size={15} />,
  draft: <PencilLine size={15} />,
  batal: <Ban size={15} />,
};

function filterOf(value: string | undefined): FilterKey {
  return FILTERS.some((f) => f.key === value) ? (value as FilterKey) : "semua";
}

/* Susunan tautan filter. Parameter q dihapus: pencarian sudah pindah
   ke tombol cari di header, jadi halaman ini tidak lagi membawa teks
   pencarian ke mana pun. Kalau nanti ditambahkan kembali, jangan
   dibandingkan dengan url penuh - cukup params.set, supaya tidak ada
   dua sumber kebenaran soal sedang searching apa. */
function href(filter: FilterKey, page: number, m: DocType | "semua", per: Record<string, string> = {}) {
  const params = new URLSearchParams();
  if (m !== "semua") params.set("m", m);
  if (filter !== "semua") params.set("f", filter);
  for (const [k, v] of Object.entries(per)) if (v) params.set(k, v);
  if (page > 1) params.set("hal", String(page));
  const qs = params.toString();
  return qs ? `/invoice?${qs}` : "/invoice";
}

/* MATCH_LABEL (label "Cocok nominal" / "Cocok kode unik" / "Cocok
   akhiran angka") DIHAPUS dari halaman ini, bersama import
   bankMatch, onlyDigits, dan tipe BankMatch.

   Chip itu hanya muncul kalau angka yang diketik cocok dengan mutasi
   bank. Sekarang tidak ada lagi angka yang diketik di sini -
   pencarian pindah ke tombol cari di header. Membiarkan labelnya
   tinggal akan jadi kode mati yang menyesatkan: nanti ada yang
   membetulkan teks "/Cocok akhiran/" dan tidak sadar teks itu sudah
   tidak pernah tampil di mana pun.

   Yang tetap hidup: computePayInfo. Dia menghitung sisa tagihan dan
   kode unik yang dicetak di kartu nominal transfer di bawah, jadi
   bukan ikut terhapus. aturannya sama persis - uniqueCode yang
   dipakai di sini dibaca dari settings, sama seperti yang dibaca
   listInvoices di header. */

export default async function InvoiceListPage({
  searchParams,
}: {
  // q sengaja TIDAK ada lagi. Pencarian pindah ke tombol cari di
  // header, jadi halaman ini tidak pernah menerima teks pencarian.
  // Periode dibaca di sini: ?p= (chip), ?dari=&sampai= (Pilih tanggal) dan
  // ?bulan= (tautan lama dari panel cari / bookmark) - lihat resolveListPeriod.
  searchParams: Promise<{ f?: string; hal?: string; m?: string; p?: string; bulan?: string; dari?: string; sampai?: string }>;
}) {
  const sp = await searchParams;
  const docType: DocType | "semua" = isDocType(sp.m) ? sp.m : "semua";
  const filter = filterOf(sp.f);
  const page = Math.max(1, Number.parseInt(sp.hal ?? "1", 10) || 1);
  const today = jakartaDateISO();
  /* Periode daftar. Bawaan (DEFAULT_LIST_PERIOD) hanya berlaku saat status
     = Semua dan orang belum memilih periode; status lain = semua tanggal;
     periode pilihan sendiri selalu dipakai. Aturan ini SENGAJA di halaman,
     bukan di listInvoices: pencarian header memakai listInvoices tanpa
     batas tanggal dan harus tetap begitu. */
  const period = resolveListPeriod(sp, today, filter === "semua");
  const perQ = listPeriodQuery(period);

  /* Rantai query DULUNYA (berurutan, tiap langkah = satu bolak-balik
     ke database):
       1. users
       2. userSessions
       3. settings
       4. listInvoices + getARSummary  (sudah paralel)

     Empat langkah berurutan. Karena Neon diakses lewat internet, setiap
     langkah menambah biaya jaringan yang terlihat di layar.

     SEKARANG satu langkah, dan tidak ada lagi kasus khusus.

     Dulu ada dua jalur. Kalau q berisi teks, settings ikut dulu karena
     kode unik dipakai untuk mencocokkan nomor rekening; kalau q kosong,
     listInvoices jalan bareng yang lain. Sekarang q tidak ada lagi -
     pencarian pindah ke tombol cari di header - jadi hanya ada satu
     jalur dan settings cukup sejajar dengan yang lain.

     bankMatchIds tidak pernah jalan di halaman ini lagi. Pencocokan
     nominal mutasi bank pindah ke header, dan di sana jalannya lewat
     listInvoices juga, bukan lewat kueri terpisah. Satu aturan
     pencocokan untuk dua tempat, tidak dua.

     uniqueCode sengaja false. Di halaman ini tidak ada teks pencarian,
     jadi kode unik tidak pernah dipakai, dan membacanya hanya menambah
     satu bolak-balik ke database tanpa efek apa pun.

     Pemeriksaan akses dipindah ke belakang karena tidak ada data yang
     ditampilkan sebelum pemeriksaan itu. Menjalankan query untuk
     pengguna yang lalu ditolak bukan kebocoran: hasilnya tidak pernah
     sampai ke layar. */
  const loaded = await safeDb(async () => {
    const [access, settings, list, ar] = await Promise.all([
      getInvoiceAccess(),
      getInvoiceSettings(),
      listInvoices({
        docType: docType === "semua" ? undefined : docType,
        status: filter === "draft" || filter === "batal" ? filter : undefined,
        payStatus: filter === "belum" || filter === "sebagian" || filter === "lunas" ? filter : undefined,
        due: filter === "lewat" ? "lewat" : undefined,
        dari: period.dari,
        sampai: period.sampai,
        uniqueCode: false,
        /* Kartu ringkasan datang dari getARSummary; `stats` tidak dibaca di
           sini. Tanpa ini listInvoices menyapu SELURUH tabel sekali lagi di
           setiap kunjungan, hanya untuk angka yang tidak ditampilkan. */
        tanpaStats: true,
        limit: PAGE_SIZE + 1,
        offset: (page - 1) * PAGE_SIZE,
      }),
      getARSummary(),
    ]);
    if (!access) return null;
    return { access, list, settings, ar };
  });
  if (!loaded.ok) return <ProblemScreen problem={loaded.problem} hint="Data invoice disimpan di database." />;
  if (!loaded.data) redirect("/tidak-diizinkan?dari=invoice");

  const { access, list, settings, ar } = loaded.data;
  const hasNext = list.rows.length > PAGE_SIZE;
  const rows = list.rows.slice(0, PAGE_SIZE);
  const mode = docType === "semua" ? DOC_MODES.invoice : DOC_MODES[docType];
  const isInvoiceView = docType === "invoice" || docType === "semua";
  const filterList = isInvoiceView ? FILTERS : FILTERS.filter((f) => ["semua", "draft", "batal"].includes(f.key));
  /* Filter yang tampil di tombol dropdown sidebar. Kalau filter di URL tidak
     ada di daftar mode ini (mis. ?f=lunas di mode Penawaran), jatuh ke
     "Semua" - sama dengan perilaku daftar, yang juga tidak menandai apa pun. */
  const activeFilter = filterList.find((f) => f.key === filter) ?? filterList[0];
  const newHref = `/invoice/baru${docType !== "semua" && docType !== "invoice" ? `?m=${docType}` : ""}`;
  /* Export mengikuti periode DAN status yang tampil di layar, dan tombolnya
     menyebut periodenya ("Export CSV · Hari ini") supaya tidak ada yang
     kaget kalau berisinya cuma beberapa baris. Draft/Batal tidak punya
     export (file ini hanya Invoice terbit). Tombol dimatikan saat daftar
     kosong, karena route export membalas JSON 404 yang akan tampil mentah
     di tab browser. */
  const exportStatus = filter === "belum" || filter === "sebagian" || filter === "lunas" || filter === "lewat" ? filter : "";
  const exportAvailable = isInvoiceView && filter !== "draft" && filter !== "batal";
  const exportEmpty = rows.length === 0;
  const exportHref = (() => {
    const p = new URLSearchParams();
    if (period.dari) p.set("dari", period.dari);
    if (period.sampai) p.set("sampai", period.sampai);
    if (exportStatus) p.set("status", exportStatus);
    const qs = p.toString();
    return qs ? `/api/invoices/export?${qs}` : "/api/invoices/export";
  })();
  const exportLabel = `Export CSV · ${period.short}`;
  const exportTitle = exportEmpty
    ? "Tidak ada invoice pada periode ini untuk diekspor"
    : `Export rekap Invoice terbit: ${period.label}${exportStatus ? ` · status ${activeFilter.label}` : ""}`;

  /* Chip periode di atas daftar (gaya sama dengan laporan). */
  const chipBase = "chip shrink-0 px-2.5 py-1.5 text-[11px] font-semibold transition-colors";
  const chipOff = `${chipBase} border-slate-200 bg-white text-slate-600 hover:bg-teal-50`;
  const chipOn = `${chipBase} flex items-center gap-1.5 border-[color:var(--pf-accent)] bg-[color:var(--pf-accent-soft)] text-[color:var(--pf-accent-strong)]`;
  const baseQs = (() => {
    const p = new URLSearchParams();
    if (docType !== "semua") p.set("m", docType);
    if (filter !== "semua") p.set("f", filter);
    return p.toString();
  })();
  const FRASA: Record<string, string> = {
    hari: "hari ini",
    kemarin: "kemarin",
    "7h": "dalam 7 hari terakhir",
    bulan: "bulan ini",
  };
  const emptyTitle = `Belum ada ${mode.label.toLowerCase()} ${FRASA[period.key] ?? `pada ${period.label}`}`;
  const quickKeys = ["kemarin", "7h", "semua"].filter((k) => k !== period.key);

  return (
    <InvoiceFrame
      sidebar={
        <InvoiceSidebar
          businessName={settings.businessName}
          isOwner={access.isOwner}
          docType={docType}
          modeBehavior="filter"
          /* Filter Status berdiri paling atas, di atas menu Invoice
             Baru / Riwayat Dokumen - diminta owner. */
          actionsPosition="top"
          /* Halaman ini satu-satunya yang drawer-nya berisi STATUS,
             bukan perintah. Jadi tombolnya ditulis "Status" - diminta
             owner. Halaman lain (detail, editor) tetap "Menu" karena
             isinya Edit / Terbitkan / Cetak dan sebagainya. */
          menuLabel="Status"
          actions={
            /* Filter status dipindah ke menu geser tiga garis (keripit
               paling kiri baris navigasi) - diminta owner. Sempat berupa
               tab segmented yang digulir mendatar: tujuh pilihan
               masing-masing ~72px di bar 336px, jadi sebagian besar
               terpotong di luar layar.

               Bentuknya DAFTAR dengan ikon kecil di kiri teks, sama
               persis dengan tombol aksi (Edit, Tandai Lunas, Cetak) di
               panel geser halaman detail - SideButton yang sama.

               Alasannya ukuran, bukan selera: chip tujuh buah mengisi
               dua-tiga baris di panel yang sebagian besar masih kosong,
               dan tiap chip cuma setinggi 28px - di bawah ambang sentuh
               44px yang dipakai tombol lain di panel itu. Setiap baris
               daftar jadi 48px, selebar panel, ikon kotak 30x30.

               "Invoice Baru" tidak ikut ke sini: tombol itu pindah ke
               tengah bottom navigation mobile. "Export CSV" ikut ke
               drawer ini di HP/tablet, sedangkan di desktop tetap di
               kanan judul. Keduanya tidak muncul dua kali di layar yang
               sama.

               Di lg ke atas sidebar menampilkan deretan filter ini
               sendiri, jadi tidak ada yang hilang di layar lebar -
               tapi sekarang berupa DROPDOWN yang tertutup secara
               bawaan (StatusFilterDropdown): sidebar cuma menampilkan
               satu tombol berisi filter yang sedang dipakai. Di bawah
               lg (menu geser) daftar tetap tampil penuh seperti dulu.
               key={filter} membuat dropdown tertutup lagi setelah
               orang memilih filter.
               Barisnya tetap <Link>, jadi halaman ini tidak berubah
               jadi client component. */
            <div className="space-y-0.5">
              <StatusFilterDropdown
                key={filter}
                currentLabel={activeFilter.label}
                currentIcon={FILTER_ICONS[activeFilter.key]}
                active={activeFilter.key !== "semua"}
              >
                {filterList.map((f) => (
                  <SideButton key={f.key} icon={FILTER_ICONS[f.key]} href={href(f.key, 1, docType, perQ)} active={filter === f.key} ariaCurrent="true">
                    {f.label}
                  </SideButton>
                ))}
              </StatusFilterDropdown>
              {exportAvailable ? (
                <div className="mt-2 border-t border-[color:var(--pf-line-soft)] pt-2 lg:hidden">
                  {exportEmpty ? (
                    <span className="ppi-side-btn cursor-not-allowed opacity-50" aria-disabled="true" title={exportTitle}>
                      <span className="ppi-ico"><Download size={15} /></span>
                      <span className="min-w-0 truncate">{exportLabel}</span>
                    </span>
                  ) : (
                    <a href={exportHref} className="ppi-side-btn" title={exportTitle}>
                      <span className="ppi-ico"><Download size={15} /></span>
                      <span className="min-w-0 truncate">{exportLabel}</span>
                    </a>
                  )}
                </div>
              ) : null}
            </div>
          }
        />
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <ReceiptText size={22} strokeWidth={2.3} /> {docType === "semua" ? "Riwayat Dokumen" : `Riwayat ${mode.label}`}
            </h1>
            <p className="text-sm text-slate-500">{isInvoiceView ? "Pantau tagihan, cocokkan mutasi bank, dan tagih yang belum bayar." : mode.hint}</p>
          </div>

           {/* Tombol DESKTOP. Di HP/tablet, "Invoice Baru" pindah ke
               tengah bottom navigation dan "Export CSV" pindah ke drawer
               tiga garis (Status), jadi baris ini tidak dirender di sana.

               Kenapa capsule: .btn-* memakai --pf-r-control yang 12px
               (sudut tumpul), sementara bentuk lain di halaman ini
               sudah bulat penuh - kartu KPI, chip status di tiap baris
               daftar, chip filter di dalam menu. Dua tombol bersudut
               12px di antara semua bentuk bulat itu terlihat seperti
               datang dari halaman berbeda.

               rounded-full datang dari utility Tailwind, sedangkan
               border-radius di .btn-* ada di @layer components - utility
               menang, jadi cukup ditambah satu kelas: tanpa !important
               dan tanpa membuat kelas btn baru. min-h-[36px] menjaga
               tombol tetap ramah jari di HP tanpa sebesar bawaan 40px. */}
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            {exportAvailable ? (
              exportEmpty ? (
                <span
                  className="btn-ghost min-h-[36px] cursor-not-allowed rounded-full px-3.5 py-1.5 text-xs opacity-50"
                  aria-disabled="true"
                  title={exportTitle}
                >
                  <Download size={14} /> {exportLabel}
                </span>
              ) : (
                <a href={exportHref} className="btn-ghost min-h-[36px] rounded-full px-3.5 py-1.5 text-xs" title={exportTitle}>
                  <Download size={14} /> {exportLabel}
                </a>
              )
            ) : null}
            <Link href={newHref} className="btn-primary min-h-[36px] rounded-full px-3.5 py-1.5 text-xs">
              <Plus size={15} /> {mode.newBtn}
            </Link>
          </div>
        </div>

        {isInvoiceView ? (
          /* ---------------------------------------------------------------
             RINGKASAN PIUTANG. Satu KpiCard yang sama dipakai di HP dan
             desktop supaya item serta gayanya tidak pernah berbeda:
             HP 2x2, desktop 4 sejajar. Ikon besar, label kecil, angka,
             hint, dan garis progres tipis - sama seperti KPI Beranda.

             "Belum jatuh tempo" = Belum dibayar - Lewat tempo. Angka ini
             tidak diambil dari database (jadi query tidak berubah): `late`
             memang bagian dari `due`, jadi selisihnya adalah sisa tagihan
             yang belum lewat tenggat - justru kelompok yang paling aman
             untuk ditagih. Tanpa kotak keempat ini, grid 4 kolom akan
             bolong dan item tidak lagi sama dengan versi HP.
             --------------------------------------------------------------- */
          (() => {
            const belumJatuhTempo = Math.max(0, ar.due - ar.late);
            const belumJatuhCount = Math.max(0, ar.dueCount - ar.lateCount);
            const totalNilai = ar.due + ar.paid;
            const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
            const r0 = (n: number) => Math.round(n);

            const ringkasan = [
              {
                key: "belum",
                label: "Belum dibayar",
                value: formatRupiah(ar.due),
                hint: `${ar.dueCount} invoice`,
                icon: <Wallet size={18} />,
                accent: "yellow" as const,
                tone: "text-[#07384f] dark:text-[color:var(--pf-ink)]",
                bar: pct(ar.due, totalNilai),
                barLabel: `${r0(pct(ar.due, totalNilai))}% dari total nilai invoice`,
              },
              {
                key: "lewat",
                label: "Lewat tempo",
                value: formatRupiah(ar.late),
                hint: `${ar.lateCount} invoice · ketuk`,
                icon: <TriangleAlert size={18} />,
                accent: "rose" as const,
                tone: ar.late > 0 ? "text-rose-600" : "text-[#07384f] dark:text-[color:var(--pf-ink)]",
                bar: pct(ar.late, ar.due),
                barLabel: `${r0(pct(ar.late, ar.due))}% dari sisa tagihan sudah lewat tempo`,
                href: href("lewat", 1, docType),
              },
              {
                key: "aman",
                label: "Belum jatuh tempo",
                value: formatRupiah(belumJatuhTempo),
                hint: `${belumJatuhCount} invoice`,
                icon: <Clock size={18} />,
                accent: "teal" as const,
                tone: "text-[#07384f] dark:text-[color:var(--pf-ink)]",
                bar: pct(belumJatuhTempo, ar.due),
                barLabel: `${r0(pct(belumJatuhTempo, ar.due))}% dari sisa tagihan masih dalam tenggat`,
              },
              {
                key: "lunas",
                label: "Sudah dibayar",
                value: formatRupiah(ar.paid),
                hint: "dari invoice terbit",
                icon: <CircleCheck size={18} />,
                accent: "teal" as const,
                tone: "text-teal-700 dark:text-emerald-400",
                bar: pct(ar.paid, totalNilai),
                barLabel: `${r0(pct(ar.paid, totalNilai))}% dari total nilai invoice sudah terkumpul`,
              },
            ];

            return (
              /* Satu grid untuk semua ukuran layar. Di HP 2x2; mulai lg
                 ke atas keempat kartu duduk sejajar dalam satu baris.
                 KpiCard dibungkus div supaya tautan "Lewat tempo" tetap
                 bisa memakai seluruh area kartu tanpa mengubah gayanya. */
              <div className="pf-kpi-grid invoice-kpi-grid -mx-3 grid grid-cols-2 gap-y-3 px-3 sm:mx-0 sm:grid-cols-2 sm:gap-x-3 sm:px-0 lg:grid-cols-4 lg:gap-y-0">
                {ringkasan.map((k) => (
                  <div key={k.key} className="min-w-0">
                    {k.href ? (
                      <Link href={k.href} className="block h-full">
                        <KpiCard label={k.label} value={k.value} hint={k.hint} icon={k.icon} accent={k.accent} tone={k.tone} bar={k.bar} barLabel={k.barLabel} />
                      </Link>
                    ) : (
                      <KpiCard label={k.label} value={k.value} hint={k.hint} icon={k.icon} accent={k.accent} tone={k.tone} bar={k.bar} barLabel={k.barLabel} />
                    )}
                  </div>
                ))}
              </div>
            );
          })()
        ) : null}

        {/* Filter status TIDAK lagi tampil di sini.

            Sempat berupa tab segmented yang digulir mendatar (tujuh
            pilihan, masing-masing ~72px dalam bar 336px - sebagian besar
            terpotong di luar layar). Sekarang ikut ke menu geser tiga
            garis bersama tombol Export CSV dan Invoice Baru; di dalam
            panel yang lebannya ~310px dan melingkar ke bawah, tujuh
            pilihan muat tanpa ada yang perlu digulir.

            Di layar lebar sidebar sudah menampilkannya sendiri, jadi
            di sini memang tidak perlu lagi. */}
        {/* Pencarian teks tetap di header dan SELALU mencari semua tanggal
            (tidak dibatasi periode chip di bawah). Format ?bulan= dan
            ?dari=&sampai= dari panel cari / bookmark lama tetap dibaca. */}

        {/* PEMISAH ANTARA KARTU RINGKASAN DAN KARTU DOKUMEN

            Di sm: ke atas, kartu ringkasan (BELUM DIBAYAR / LEWAT TEMPO
            / BELUM JATUH TEMPO / SUDAH DIBAYAR) dan baris kartu dokumen
            adalah dua kelompok yang berbeda. Keduanya memakai grid dengan
            jarak yang sama, jadi tanpa pemisah mata menganggapnya satu
            blok menyambung dan tidak tahu harus berhenti di mana.

            Garis tipis + jarak tambahan memberitahu: yang atas adalah
            angka rekap, yang bawah adalah daftar.

            HANYA di sm: ke atas. Di bawah itu kartu ringkasan masih
            susun 2x2 dan jaraknya sudah cukup jelas; garis tambahan
            hanya membuat layar yang sudah sempit makin padat tanpa
            menambah informasi apa pun. Di lg: ke atas kartu ringkasan
            menjadi empat kolom sejajar, jadi garis pemisah makin
            membantu.

            Garisnya memakai --pf-line-soft, bukan --pf-line. Yang
            setebal penuh akan tergambar seberat kartu-kartu di
            bawahnya, dan garis selalu membelah halaman jadi dua blok
            yang sama beratnya - persis kesan yang mau dihilangkan. */}
        <div className="sm:mt-6 sm:border-t sm:border-[color:var(--pf-line-soft)] sm:pt-6">
          <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Periode tanggal dokumen">
            {LIST_PRESETS.map((p) => {
              const on = period.key === p.key;
              return (
                <Link
                  key={p.key}
                  href={href(filter, 1, docType, { p: p.key })}
                  aria-current={on ? "true" : undefined}
                  className={on ? chipOn : chipOff}
                >
                  {on ? <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--pf-accent-strong)]" aria-hidden /> : null}
                  {p.label}
                </Link>
              );
            })}
            <PeriodeTanggalChip
              base={baseQs}
              active={period.key === "tanggal"}
              activeLabel={period.label}
              initialDari={period.dari ?? today}
              initialSampai={period.sampai ?? today}
              className={chipOff}
              activeClassName={chipOn}
            />
          </div>

          {rows.length === 0 ? (
            period.key !== "semua" ? (
              <EmptyState
                icon={<ReceiptText size={26} />}
                title={emptyTitle}
                description={
                  <span className="flex flex-col items-center gap-3">
                    <span>
                      Datanya tidak hilang: daftar ini sedang menampilkan {period.label.toLowerCase()}
                      {filter !== "semua" ? ` dengan status ${activeFilter.label.toLowerCase()}` : ""}.
                    </span>
                    <span className="flex flex-wrap justify-center gap-2">
                      {quickKeys.map((k) => (
                        <Link key={k} href={href(filter, 1, docType, { p: k })} className="btn-ghost px-3 py-2 text-xs">
                          {LIST_PRESETS.find((x) => x.key === k)?.label}
                        </Link>
                      ))}
                    </span>
                  </span>
                }
                action={{ href: newHref, label: mode.newBtn, icon: <Plus size={15} /> }}
              />
            ) : (
              <EmptyState
                icon={<ReceiptText size={26} />}
                title={filter !== "semua" ? "Tidak ada dokumen yang cocok" : "Belum ada dokumen"}
                description={
                  filter !== "semua"
                    ? "Coba ganti filter status."
                    : "Buat dokumen pertama: isi item di tabel, isi customer, lalu terbitkan. Nomor resminya keluar otomatis."
                }
                action={{ href: newHref, label: mode.newBtn, icon: <Plus size={15} /> }}
              />
            )
          ) : (
            <InvoiceHistoryList rows={rows} today={today} uniqueCodeEnabled={settings.uniqueCode} />
          )}

        {page > 1 || hasNext ? (
          <div className="flex items-center justify-between gap-2">
            {page > 1 ? (
              <Link href={href(filter, page - 1, docType, perQ)} className="btn-ghost px-3 py-2 text-xs">
                <ChevronLeft size={14} /> Sebelumnya
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-slate-400">Halaman {page}</span>
            {hasNext ? (
              <Link href={href(filter, page + 1, docType, perQ)} className="btn-ghost px-3 py-2 text-xs">
                Berikutnya <ChevronRight size={14} />
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
        </div>
      </div>
    </InvoiceFrame>
  );
}
