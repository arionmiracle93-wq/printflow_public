import Link from "next/link";
import { ShieldX } from "lucide-react";
export default function ForbiddenPage() { return <div className="mx-auto max-w-md py-16 text-center"><div className="card p-8"><ShieldX size={44} className="mx-auto text-rose-500" /><h1 className="mt-3 text-xl font-black text-[#07384f]">Akses tidak diizinkan</h1><p className="mt-2 text-sm text-slate-500">Role akun Anda tidak memiliki izin membuka halaman ini. Hubungi Owner bila akses diperlukan.</p><Link href="/" className="btn-primary mt-5">Kembali ke Dashboard</Link></div></div>; }
