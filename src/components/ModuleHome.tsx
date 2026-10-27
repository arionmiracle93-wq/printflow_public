"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  CreditCard,
  Factory,
  FilePlus2,
  Lock,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";
import { Greeting } from "@/components/Greeting";

/**
 * HOME SCREEN PEMILIH MODUL (rute "/")
 * =========================================================================
 * Tampilan mengikuti referensi owner: latar navy-teal gelap, brand di kiri
 * atas, sapaan besar, lalu dua kartu modul yang setara. Produksi memakai
 * aksen teal, Invoice memakai aksen amber - dua warna yang sudah menjadi
 * identitas aplikasi.
 *
 * Aturan yang tetap dipegang:
 *
 * 1. TIDAK ADA QUERY DATA MODUL. Kartu tidak menampilkan jumlah
 *    pekerjaan aktif atau invoice belum lunas. Home harus tetap ringan
 *    dan cepat muncul, terutama saat jaringan buruk.
 *
 * 2. KARTU TANPA IZIN DIKUNCI, BUKAN DISEMBUNYIKAN. Kartu Invoice tetap
 *    terlihat, menjelaskan bahwa modulnya ada, dan memberi tahu ke mana
 *    izin dinyalakan. Server tetap yang menegakkan izin.
 *
 * 3. KEDUA KARTU SETARA. Struktur, ukuran ikon, jarak, dan tombolnya
 *    sama. Yang membedakan hanya warna aksen dan isi fiturnya.
 */

type Fitur = {
  label: string;
  Ikon: LucideIcon;
};

type Kartu = {
  kunci: "produksi" | "invoice";
  href: string;
  nama: string;
  deskripsi: string;
  Ikon: LucideIcon;
  fitur: Fitur[];
};

const KARTU: Kartu[] = [
  {
    kunci: "produksi",
    href: "/produksi",
    nama: "Produksi",
    deskripsi: "Antrean, status, dan tahapan pekerjaan",
    Ikon: Factory,
    fitur: [
      { label: "Kelola antrean", Ikon: ClipboardList },
      { label: "Cek status", Ikon: BarChart3 },
      { label: "Tahapan kerja", Ikon: CircleCheck },
    ],
  },
  {
    kunci: "invoice",
    href: "/invoice",
    nama: "Invoice",
    deskripsi: "Tagihan, pembayaran, dan laporan",
    Ikon: ReceiptText,
    fitur: [
      { label: "Buat Invoice", Ikon: FilePlus2 },
      { label: "Cek Pembayaran", Ikon: CreditCard },
      { label: "Laporan", Ikon: BarChart3 },
    ],
  },
];

const PESAN_TERKUNCI =
  "Modul Invoice belum diaktifkan untuk akun ini. Owner bisa menyalakannya di halaman Pengguna.";

/** Garis lengkung dekoratif di sudut kanan bawah kartu. */
function CardWave() {
  return (
    <svg viewBox="0 0 420 220" fill="none" aria-hidden="true">
      <path
        d="M0 198c86 0 122-78 196-78 74 0 96 54 224 54"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M0 220c100 0 140-92 222-92 82 0 104 66 198 66"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity=".7"
      />
    </svg>
  );
}

function CardBody({
  kartu,
  terkunci,
  terbuka,
}: {
  kartu: Kartu;
  terkunci: boolean;
  terbuka: boolean;
}) {
  const Ikon = kartu.Ikon;

  return (
    <>
      <span className="pf-module-card__wave" aria-hidden="true">
        <CardWave />
      </span>

      <span className="pf-module-card__head">
        <span className="pf-module-card__icon" aria-hidden="true">
          <Ikon size={36} strokeWidth={1.9} />
          {terkunci ? (
            <span className="pf-module-card__lock">
              <Lock size={12} strokeWidth={2.5} />
            </span>
          ) : null}
        </span>
        <span className="pf-module-card__copy">
          <span className="pf-module-card__title">{kartu.nama}</span>
          <span className="pf-module-card__desc">{kartu.deskripsi}</span>
        </span>
      </span>

      <span className="pf-module-card__features">
        {kartu.fitur.map(({ label, Ikon: FiturIkon }) => (
          <span key={label} className="pf-module-feature">
            <span className="pf-module-feature__icon" aria-hidden="true">
              <FiturIkon size={15} strokeWidth={2.1} />
            </span>
            <span className="pf-module-feature__label">{label}</span>
          </span>
        ))}
      </span>

      <span className="pf-module-card__btn">
        {terkunci ? (
          <>
            <Lock size={15} strokeWidth={2.4} className="pf-module-card__cta-lock" />
            <span>Perlu izin Owner</span>
          </>
        ) : (
          <>
            <span>Buka {kartu.nama}</span>
            <ChevronRight size={18} strokeWidth={2.7} className="pf-module-card__chevron" />
          </>
        )}
      </span>

      {terkunci && terbuka ? <span className="pf-module-card__note">{PESAN_TERKUNCI}</span> : null}
    </>
  );
}

export function ModuleHome({ nama, bisaInvoice }: { nama: string; bisaInvoice: boolean }) {
  /* Keterangan kartu terkunci dibuka-tutup di tempat, bukan lewat dialog.
     Dialog untuk satu kalimat pendek terasa berlebihan, dan aria-expanded
     di tombol yang sama sudah cukup jelas buat pembaca layar. */
  const [buka, setBuka] = useState<string | null>(null);

  return (
    <div className="pf-home">
      <div className="pf-home__shell">
        <div className="pf-home__left">
          {/* Brand di kiri atas. Header aplikasi sengaja disembunyikan di
              halaman ini (lihat home.css) supaya home punya identitas sendiri
              seperti gambar referensi. */}
          <div className="pf-home__brand">
            {/* Logo resmi Print Flow (berkas public/images/print-flow-logo.png).
                Sengaja tidak digambar ulang sebagai SVG: sumber kebenarannya
                satu berkas gambar, jadi kalau logo diperbarui cukup ganti
                berkasnya. Ditaruh di /images supaya tidak ikut dijaga proxy
                login - aset statis harus selalu bisa diambil browser. */}
            <span className="pf-home__logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/print-flow-logo.png"
                alt=""
                width={40}
                height={40}
                className="pf-home__logo-img"
                draggable={false}
              />
            </span>
            <span className="pf-home__wordmark">Print Flow</span>
          </div>

          <div className="pf-home__intro">
            <h1 className="pf-home__hello">
              <span className="pf-home__hello-line">
                <Greeting />,
              </span>{" "}
              <span className="pf-home__hello-name">{nama || "Print Flow"}</span>
            </h1>
            <p className="pf-home__sub">Kelola produksi &amp; bisnis printmu dengan mudah</p>
          </div>

          {/* Ilustrasi mesin cetak + dokumen. Hanya tampil di desktop;
              di HP ruang dipakai untuk kartu modul agar layar tidak penuh.
              Berkas dibuat dari aset referensi owner di public/images. */}
          <div className="pf-home__art" aria-hidden="true">
            <Image
              src="/images/home-printer.png"
              alt=""
              width={952}
              height={640}
              sizes="(min-width: 1024px) 920px, 1px"
              loading="lazy"
              className="pf-home__art-img"
            />
          </div>
        </div>

        <div className="pf-home__cards">
          {KARTU.map((kartu) => {
            const terkunci = kartu.kunci === "invoice" && !bisaInvoice;
            const terbuka = buka === kartu.kunci;

            if (terkunci) {
              /* Kartu terkunci tetap <button> dengan aria-disabled, bukan
                 elemen non-interaktif dan bukan <button disabled>. Dengan
                 aria-disabled, tombol tetap bisa difokus, tetap dibaca
                 "tidak aktif", dan tetap bisa memicu penjelasan. */
              return (
                <button
                  key={kartu.kunci}
                  type="button"
                  aria-disabled="true"
                  aria-expanded={terbuka}
                  onClick={() => setBuka(terbuka ? null : kartu.kunci)}
                  className={`pf-module-card pf-module-card--${kartu.kunci} pf-module-card--locked`}
                >
                  <CardBody kartu={kartu} terkunci terbuka={terbuka} />
                </button>
              );
            }

            return (
              <Link
                key={kartu.kunci}
                href={kartu.href}
                prefetch={false}
                aria-label={`Buka modul ${kartu.nama}`}
                className={`pf-module-card pf-module-card--${kartu.kunci}`}
              >
                <CardBody kartu={kartu} terkunci={false} terbuka={false} />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
