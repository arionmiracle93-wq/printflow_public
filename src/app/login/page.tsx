import { Suspense } from "react";
import { LockKeyhole } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Login — Print Flow" };

// Kurva "S" pembatas panel video vs panel form — diambil PERSIS dari
// curved-divider-master.svg (viewBox 0 0 216 665, path id "master-curved-
// divider"). 216 = lebar area jelajah kurva pada kartu referensi lebar
// 1318 (dari x=552 s/d x=768), jadi titik-titiknya di sini sudah digeser
// +552 lalu dinormalisasi 0-1 (objectBoundingBox) supaya otomatis ikut
// ukuran kartu di layar manapun. loginFormClip adalah KOMPLEMEN dari
// loginVideoClip (path sama persis, cuma titik awal/tutupnya beda) —
// jadi dua panel selalu nyambung pas tanpa celah, seberapa pun kartu
// di-resize.
const LOGIN_CURVE_PATH =
  "M0.5827,0 C0.56935,0.00602 0.52929,0.02797 0.50607,0.10075 C0.47557,0.19654 0.4931,0.31203 0.50379,0.41353 " +
  "C0.51047,0.47729 0.51608,0.53053 0.51821,0.58496 C0.52086,0.65474 0.52443,0.74617 0.50152,0.83759 " +
  "C0.47951,0.92526 0.44279,0.97474 0.41882,1";

// Path yang sama, tapi dalam satuan kartu asli (viewBox 0 0 1318 665) —
// dipakai buat garis tepi kaca yang kelihatan (bukan clip-path yang
// invisible). Angkanya murni hasil geser +552 dari titik lokal SVG, TANPA
// dibulatkan ulang jadi bukan pendekatan baru, cuma satuan berbeda dari
// LOGIN_CURVE_PATH di atas.
const LOGIN_CURVE_STROKE_D =
  "M768,0 C750.4,4 697.6,18.6 667,67 C626.8,130.7 649.9,207.5 664,275 " +
  "C672.8,317.4 680.2,352.8 683,389 C686.5,435.4 691.2,496.2 661,557 " +
  "C632,615.3 583.6,648.2 552,665";

export default function LoginPage() {
  return (
    <>
      {/* Wrapper fixed penuh-viewport, TIDAK ikut lebar max-w-[1440px] atau
          padding <main> dari layout.tsx — supaya background beneran nutup
          seluruh layar (termasuk di belakang header), bukan cuma area
          konten yang dikasih jarak sama shell aplikasi. bg-[#052c3f] di
          elemen terluar cuma fallback warna kalau layar lebih lebar dari
          mesh gradasinya (lihat max-w di div sebelah dalam) — bukan warna
          baru yang mencolok, diambil dari nada gelap linear-gradient yang
          sama di printflow-login-background.css.
          .printflow-login-bg sendiri (dari printflow-login-background.css)
          yang pasang position:relative/isolate/overflow-hidden +
          gradasinya. Lebar mesh-nya sengaja dibatasi (max-w) & dipusatkan
          (mx-auto) SEJAJAR sama kartu login di bawahnya — supaya bulatan
          gradasi cyan/emas yang posisinya pakai persen (kanan/kiri) selalu
          "nempel" di belakang kartu & panel form, persis kayak di versi
          mobile (di HP, lebar layar ≈ lebar kartu jadi otomatis nempel;
          di desktop lebar layar bisa jauh lebih lebar dari kartu, makanya
          perlu dibatasi manual di sini). */}
      <div className="fixed inset-0 -z-10 bg-[#052c3f]" aria-hidden="true">
        <div className="printflow-login-bg mx-auto h-full w-full max-w-[1680px]">
          {/* Elemen tambahan murni buat texture/vignette yang diminta CSS
              printflow-login-background.css (selector `.printflow-login-bg >
              .printflow-bg-texture` & `> .printflow-bg-vignette`) — tidak
              menyentuh struktur/logic form login sama sekali. */}
          <div className="printflow-bg-texture" />
          <div className="printflow-bg-vignette" />
        </div>
      </div>

      {/* Definisi clip-path kurva (invisible) — lihat komentar
          LOGIN_CURVE_PATH di atas. */}
      <svg width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="loginVideoClip" clipPathUnits="objectBoundingBox">
            <path d={`M0,0 L${LOGIN_CURVE_PATH.slice(1)} L0,1 Z`} />
          </clipPath>
          <clipPath id="loginFormClip" clipPathUnits="objectBoundingBox">
            <path d={`M1,0 L${LOGIN_CURVE_PATH.slice(1)} L1,1 Z`} />
          </clipPath>
        </defs>
      </svg>

      {/* min-h-[80vh] tetap ukuran penuh, TIDAK ikut mengecil — biar area
          vertikal tempat kartu di-center tidak berubah. max-w-5xl (1024px)
          diganti max-w-[57.6rem] (921.6px = persis 1024×0.9) — inilah
          yang bikin kartu ~10% lebih kecil sekarang, BUKAN transform/zoom
          lagi. Kenapa ganti pendekatan: transform:scale() (bahkan yang
          sudah dipisah dari elemen backdrop-filter) TERBUKTI masih bikin
          teks agak blur — itu memang keterbatasan umum GPU compositing
          kalau nge-scale konten yang ada teksnya (browser tetap sempat
          "mencetak" lapisan itu sebagai bitmap sebelum di-scale, sekecil
          apapun kemungkinannya). Satu-satunya cara yang 100% dijamin tajam
          adalah TIDAK PERNAH nge-scale sama sekali — jadi kartu & semua
          isinya (padding, gap, ukuran font, ukuran ikon) di bawah ini
          BENERAN dibikin ~10% lebih kecil dari awal (real size, direct
          dari CSS), bukan dirender besar lalu di-kecilin belakangan.
          Semua pengecilan di bawah cuma lewat class ber-prefix md: —
          mobile 100% tidak disentuh, persis kayak sebelumnya. */}
      <div className="relative mx-auto flex min-h-[80vh] max-w-[57.6rem] items-center px-3 sm:px-4">
        <div className="login-glass-card relative rounded-[1.75rem] md:aspect-[1318/665] md:min-h-[396px] md:rounded-[2.5rem]">
          {/* Panel foto/video — kotak biasa di atas saat mobile (pendek, tanpa
              kurva); jadi lapisan penuh yang di-clip kurva saat md+.
              Isi /public/images/login-hero.jpg [desktop, jadi poster video] &
              login-hero-mobile.jpg [HP, background statis lewat .login-photo-bg]. */}
          <div className="login-photo-bg login-video-panel relative isolate h-36 overflow-hidden text-white sm:h-44 md:absolute md:inset-0 md:h-full">
            {/* Wrapper video dibatasi selebar jangkauan TERLEBAR kurva
                (58.27%) — bukan selebar kartu penuh — supaya object-cover
                videonya wajar (gak zoom ke tengah), pas mengisi panel kiri. */}
            <div className="absolute inset-y-0 left-0 hidden w-full md:block md:w-[58.27%]">
              <video
                className="login-hero-video h-full w-full object-cover object-[12%_center]"
                src="/videos/login-hero.mp4"
                poster="/images/login-hero.jpg"
                autoPlay
                muted
                loop
                playsInline
                preload="none"
              />
            </div>
          </div>

          {/* Panel form — komplemen kurva di atas. Konten diberi jarak kiri
              60% (md:pl-[60%]) supaya selalu aman dari titik terlebar kurva
              (58.27%), berapa pun tinggi kartunya. Padding vertikal/kanan
              (py-8→2.025rem, pr-9→2.025rem... lihat angka persis di bawah)
              ikut dikecilkan ~10% cuma di md: biar proporsinya senada sama
              kartu yang sekarang lebih kecil — pl-[60%] sendiri persentase,
              otomatis ikut menyesuaikan tanpa perlu diubah. */}
          <div className="login-form-panel relative md:absolute md:inset-0 md:h-full">
            <div className="p-6 md:flex md:h-full md:flex-col md:justify-center md:py-[1.8rem] md:pl-[60%] md:pr-[2.025rem]">
              <div className="mb-5 flex items-center gap-2 md:mb-[1.125rem] md:gap-[0.45rem]">
                <span className="login-icon-tile md:h-[2.025rem] md:w-[2.025rem] md:rounded-[0.675rem] md:[&>svg]:h-[15.3px] md:[&>svg]:w-[15.3px]">
                  <LockKeyhole size={17} />
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-white md:text-[0.7875rem]">Masuk ke akun Anda</h2>
                  <p className="text-[11px] text-slate-300/80 md:text-[9.9px]">Gunakan akun Owner atau Karyawan.</p>
                </div>
              </div>
              <Suspense fallback={<p className="text-sm text-slate-300 md:text-[0.7875rem]">Memuat form…</p>}>
                <LoginForm />
              </Suspense>
              <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400 md:mt-[0.9rem] md:text-[9.9px]">
                Lupa password? Minta Owner membuka{" "}
                <span className="font-bold text-slate-300">Kelola Pengguna</span> untuk mereset akun Anda.
              </p>
            </div>
          </div>

          {/* Garis tepi kaca yang bercahaya halus, mengikuti kurva persis.
              Kalibrasi ulang berdasarkan sampling pixel LANGSUNG dari
              screenshot referensi (bukan cuma dikira-kira): di referensi,
              area di kiri & kanan garis TETAP FLAT sampai 1-2px sebelum
              garisnya — jadi TIDAK ada halo lebar yang menyebar, murni garis
              tipis yang terang/hampir solid (puncak terang ~rgb(115,214,232)
              persis di garisnya). Makanya dua lapis di bawah ini beda total
              dari versi lama (yang glow-nya kelebaran 9px + blur 4.5 → jadi
              kabur, sementara garis intinya cuma 45% opacity → jadi redup):
              - lapis 1 (glow): SEMPIT & blur KECIL, cuma buat kasih pendar
                tipis pas di sekitar garis, bukan halo besar.
              - lapis 2 (core): opacity TINGGI (nyaris solid) meniru garis
                terang di referensi, bukan garis redup transparan.
              vector-effect="non-scaling-stroke" menjaga ketebalannya tetap
              berapa pun ukuran kartunya — TIDAK diubah sama sekali dari
              revisi sebelumnya, termasuk sekarang kartunya jadi ~10% lebih
              kecil: non-scaling-stroke justru menjamin garisnya tetap
              setebal ini di layar, gak ikut mengecil/menebal. */}
          <svg
            className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
            viewBox="0 0 1318 665"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <filter id="loginCurveGlow" x="-60%" y="-30%" width="220%" height="160%">
                <feGaussianBlur stdDeviation="1.3" />
              </filter>
            </defs>
            <path
              d={LOGIN_CURVE_STROKE_D}
              fill="none"
              stroke="rgba(120,225,238,0.32)"
              strokeWidth="4"
              vectorEffect="non-scaling-stroke"
              filter="url(#loginCurveGlow)"
            />
            <path
              d={LOGIN_CURVE_STROKE_D}
              fill="none"
              stroke="rgba(150,232,244,0.92)"
              strokeWidth="2.2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>
    </>
  );
}
