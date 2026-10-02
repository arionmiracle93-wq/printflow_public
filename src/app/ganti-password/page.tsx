import { Lock } from "lucide-react";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default function GantiPasswordPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Lock size={22} strokeWidth={2.3} /> Ganti Password
        </h1>
        <p className="text-sm text-slate-500">Berlaku untuk akun Anda sendiri. Perangkat lain yang sedang login akan otomatis keluar setelah ini disimpan.</p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
