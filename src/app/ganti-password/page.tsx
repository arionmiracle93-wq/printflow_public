import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default function GantiPasswordPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 md:text-2xl">🔒 Ganti Password</h1>
        <p className="text-sm text-slate-500">Berlaku untuk akun Anda sendiri. Perangkat lain yang sedang login akan otomatis keluar setelah ini disimpan.</p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
