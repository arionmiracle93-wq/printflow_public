import { Suspense } from "react";
import { LockKeyhole } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Login — Print Flow" };
export default function LoginPage() {
  return <div className="mx-auto flex min-h-[68vh] max-w-md items-center"><div className="card w-full overflow-hidden"><div className="bg-gradient-to-br from-[#07384f] to-teal-700 p-6 text-center text-white"><span className="mx-auto block w-fit"><BrandMark /></span><h1 className="mt-3 text-2xl font-black">Print Flow</h1><p className="mt-1 text-sm text-cyan-50/75">Monitoring Produksi Percetakan</p></div><div className="p-6"><div className="mb-5 flex items-center gap-2"><span className="icon-tile"><LockKeyhole size={17} /></span><div><h2 className="text-sm font-extrabold text-[#07384f]">Masuk ke akun Anda</h2><p className="text-[11px] text-slate-500">Gunakan akun Owner atau Karyawan.</p></div></div><Suspense fallback={<p className="text-sm text-slate-500">Memuat form…</p>}><LoginForm /></Suspense></div></div></div>;
}
