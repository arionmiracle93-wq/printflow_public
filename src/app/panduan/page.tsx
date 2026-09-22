import { AlertTriangle, BookOpen, Download, FileText } from "lucide-react";
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const metadata = {
  title: "Panduan Lengkap — Print Flow",
  description: "Panduan langkah demi langkah untuk Neon, GitHub, Vercel, dan APK Android.",
};

function loadGuide(): { content: string; error: string | null } {
  try {
    const file = path.join(process.cwd(), "public", "panduan-deploy-neon-vercel.md");
    return { content: fs.readFileSync(file, "utf8"), error: null };
  } catch {
    return { content: "", error: "Berkas panduan tidak dapat dibaca di server." };
  }
}

export default function PanduanPage() {
  const { content, error } = loadGuide();

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 md:text-2xl">
            <BookOpen size={22} strokeWidth={2.3} /> Panduan Lengkap (Bahasa Awam)
          </h1>
          <p className="text-sm text-slate-500">
            Langkah demi langkah: GitHub → Neon → Vercel → APK Android. Termasuk PRD, daftar file untuk GitHub, dan
            troubleshooting (termasuk solusi halaman blank/hitam).
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/catatan-perubahan" className="btn-ghost inline-flex items-center gap-1.5">
            <FileText size={14} /> Catatan Perubahan
          </Link>
          <a href="/panduan-deploy-neon-vercel.md" target="_blank" rel="noreferrer" className="btn-primary inline-flex items-center gap-1.5">
            <Download size={14} /> Buka / unduh file .md
          </a>
        </div>
      </div>

      {error ? (
        <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={14} className="mr-1 inline" /> {error} Silakan buka langsung{" "}
          <a href="/panduan-deploy-neon-vercel.md" className="font-bold underline">
            /panduan-deploy-neon-vercel.md
          </a>
          .
        </div>
      ) : (
        <article className="card px-4 py-6 md:px-8 md:py-8">
          <div className="max-w-3xl text-sm leading-relaxed text-slate-700 [&_a]:text-teal-700 [&_a]:underline dark:[&_a]:text-teal-300 [&_blockquote]:border-l-4 [&_blockquote]:border-teal-200 [&_blockquote]:bg-teal-50/60 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:text-slate-700 dark:[&_blockquote]:border-teal-800/50 dark:[&_blockquote]:bg-teal-500/10 dark:[&_blockquote]:text-slate-300 [&_code]:rounded-md [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:text-slate-800 dark:[&_code]:bg-white/10 dark:[&_code]:text-slate-200 [&_h1]:mt-2 [&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:text-slate-900 dark:[&_h1]:text-slate-100 [&_h2]:mt-10 [&_h2]:border-b [&_h2]:border-slate-200 [&_h2]:pb-2 [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:text-slate-900 dark:[&_h2]:border-white/10 dark:[&_h2]:text-slate-100 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-800 dark:[&_h3]:text-slate-200 [&_hr]:my-8 [&_hr]:border-slate-200 dark:[&_hr]:border-white/10 [&_li]:mt-1 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_p]:mt-3 [&_pre]:mt-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre]:text-[12px] [&_pre]:text-slate-100 [&_pre_code]:bg-transparent [&_pre_code]:text-slate-100 [&_strong]:font-bold [&_strong]:text-slate-900 dark:[&_strong]:text-slate-100 [&_table]:mt-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[13px] [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top dark:[&_td]:border-white/10 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left dark:[&_th]:border-white/10 dark:[&_th]:bg-white/5 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </article>
      )}
    </div>
  );
}
