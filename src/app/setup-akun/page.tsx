import { UserRoundPlus } from "lucide-react";
import { BootstrapOwnerForm } from "@/components/BootstrapOwnerForm";

export const metadata = { title: "Buat Owner Pertama — Print Flow" };
export default function SetupAkunPage() {
  return <div className="mx-auto max-w-lg py-8"><div className="card overflow-hidden"><div className="bg-gradient-to-r from-[#07384f] to-teal-700 px-6 py-5 text-white"><UserRoundPlus size={26} className="text-amber-300" /><h1 className="mt-2 text-xl font-black">Buat akun Owner pertama</h1><p className="mt-1 text-sm text-cyan-50/75">Hanya bisa dilakukan saat belum ada pengguna sama sekali.</p></div><div className="p-6"><p className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">Sebelum melanjutkan, buka <strong>/api/setup</strong> sekali. Simpan password dengan aman—Owner dapat membuat akun karyawan setelah login.</p><BootstrapOwnerForm /></div></div></div>;
}
