import fs from "node:fs";
import path from "node:path";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Catatan Perubahan — Print Flow",
  description: "Dokumentasi setiap update aplikasi dalam berkas .txt yang mudah dibaca penuh.",
};

const FOLDER = "dokumentasi-update";

function loadDocs(): { name: string; content: string; size: number }[] {
  try {
    const dir = path.join(process.cwd(), "public", FOLDER);
    if (!fs.existsSync(dir)) return [];
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".txt"))
      .sort();

    return files.map((name) => {
      const content = fs.readFileSync(path.join(dir, name), "utf8");
      return { name, content, size: content.length };
    });
  } catch {
    return [];
  }
}

/** File daftar isi ditampilkan paling atas, file tanggal terbaru berikutnya. */
function sortKey(name: string) {
  return name.startsWith("00-") ? "0" : name;
}

export default function CatatanPerubahanPage() {
  const docs = loadDocs().sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name)));

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-300">Dokumentasi</p>
          <h1 className="mt-1 text-xl font-extrabold md:text-2xl">📄 Catatan Perubahan</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-300">
            Setiap update penting disimpan sebagai berkas <code>.txt</code> supaya bisa dibaca{" "}
            <strong>sampai selesai tanpa terpotong</strong>. Bisa dibaca di sini, atau diunduh untuk disimpan.
          </p>
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-3">
          <Info label="Jumlah dokumen" value={`${docs.length} berkas`} />
          <Info label="Lokasi di GitHub" value={`public/${FOLDER}/`} />
          <Info label="Format" value="Teks biasa (.txt)" />
        </div>
      </div>

      {docs.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-4xl">📄</p>
          <p className="mt-2 font-bold text-slate-700">Belum ada catatan perubahan</p>
          <p className="mt-1 text-sm text-slate-500">
            Folder <code>public/{FOLDER}/</code> belum berisi berkas <code>.txt</code>.
          </p>
        </div>
      ) : (
        <>
          {/* DAFTAR & UNDUH */}
          <div className="card p-4">
            <h2 className="text-sm font-bold text-slate-900">🗂️ Daftar berkas (klik untuk mengunduh)</h2>
            <ul className="mt-2 space-y-1.5">
              {docs.map((doc) => (
                <li key={doc.name}>
                  <a
                    href={`/${FOLDER}/${doc.name}`}
                    download
                    className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm transition hover:bg-indigo-50"
                  >
                    <span className="truncate font-semibold text-slate-700">📄 {doc.name}</span>
                    <span className="shrink-0 text-[11px] font-bold text-indigo-600">⬇️ {(doc.size / 1024).toFixed(1)} KB</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* ISI DOKUMEN */}
          {docs.map((doc) => (
            <div key={doc.name} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <p className="text-xs font-bold text-slate-700">{doc.name}</p>
                <a
                  href={`/${FOLDER}/${doc.name}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold text-indigo-600 hover:underline"
                >
                  buka berkas asli →
                </a>
              </div>
              {/* pre agar baris tidak dipotong dan tampil apa adanya */}
              <pre className="scroll-x overflow-x-auto px-4 py-4 text-[11.5px] leading-relaxed text-slate-700 sm:text-xs">
                {doc.content}
              </pre>
            </div>
          ))}
        </>
      )}

      <div className="card p-4">
        <h2 className="text-sm font-bold text-slate-900">📌 Kesepakatan ke depan</h2>
        <p className="mt-1 text-sm text-slate-600">
          Kalau balasan saya panjang <strong>dan</strong> penting untuk dokumentasi perubahan, akan saya buatkan
          berkas <code>.txt</code> di folder ini, lalu halaman ini otomatis menampilkannya. Dokumen{" "}
          <code>00-DAFTAR-ISI.txt</code> selalu berisi peta terkini beserta ringkasan semua perubahan sejak awal.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/panduan" className="btn-ghost">
            📘 Panduan Lengkap
          </Link>
          <Link href="/pengaturan" className="btn-ghost">
            ⚙️ Pengaturan
          </Link>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="truncate text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
