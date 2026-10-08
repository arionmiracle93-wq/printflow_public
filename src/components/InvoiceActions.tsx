"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, BadgeCheck, BellRing, Copy, FileCheck2, Loader2, Pencil, Send, Trash2 } from "lucide-react";
import { OPEN_REMINDER_EVENT } from "@/components/ReminderModal";
import { SideButton } from "@/components/InvoiceSidebar";
import { formatRupiah } from "@/lib/domain";

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/**
 * Tombol aksi dokumen. layout="side" dipakai di sidebar (layar lebar),
 * layout="row" dipakai sebagai baris tombol di HP.
 */
export function InvoiceActions({
  layout,
  id,
  docType,
  status,
  isOwner,
  canEdit,
  hasActivePayments,
  remaining,
  payMethod,
  alreadyConverted,
}: {
  layout: "side" | "row";
  id: number;
  docType: string;
  status: string;
  isOwner: boolean;
  canEdit: boolean;
  hasActivePayments: boolean;
  remaining: number;
  payMethod: string;
  alreadyConverted: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Kode unik pelunasan: tombol tertekan dua kali tidak mencatat dobel. Diganti baru setelah berhasil.
  const [payCode, setPayCode] = useState(() => uuid());

  async function send(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; penjelasan?: string; newId?: number };
  }

  async function run(kind: "issue" | "delete" | "void" | "convert" | "duplicate" | "lunas") {
    setError(null);
    let url = `/api/invoices/${id}/${kind}`;
    let method = "POST";
    let body: unknown;
    if (kind === "delete") {
      if (!confirm("Hapus draft ini? Draft yang dihapus tidak bisa dikembalikan.")) return;
      url = `/api/invoices/${id}`;
      method = "DELETE";
    }
    if (kind === "void") {
      const reason = prompt("Alasan membatalkan dokumen ini (wajib):")?.trim();
      if (!reason) return;
      if (!confirm("Batalkan dokumen ini? Dokumen yang dibatalkan tidak bisa dipakai lagi (tetap tersimpan sebagai arsip).")) return;
      body = { reason };
    }
    if (kind === "convert" && !confirm("Jadikan Invoice?\n\nIsi item, customer, dan syarat disalin ke draft Invoice baru. Dokumen ini tidak dihapus.")) return;
    if (kind === "lunas") {
      if (!confirm(`Tandai LUNAS?\n\nDicatat pembayaran ${formatRupiah(remaining)} via ${payMethod} sebagai pelunasan.`)) return;
      url = `/api/invoices/${id}/payments`;
      body = { amount: remaining, method: payMethod, note: "Tandai lunas", clientRef: payCode };
    }
    setBusy(kind);
    try {
      const json = await send(url, method, body);
      if (!json.ok) {
        setError(json.error ?? json.penjelasan ?? "Aksi gagal. Coba lagi.");
        return;
      }
      if (kind === "lunas") setPayCode(uuid());
      if (kind === "delete") router.push("/invoice");
      else if ((kind === "convert" || kind === "duplicate") && json.newId) router.push(`/invoice/${json.newId}`);
      router.refresh();
    } catch {
      setError("Koneksi terputus. Cek internet lalu coba lagi.");
    } finally {
      setBusy(null);
    }
  }

  const spin = (k: string, icon: React.ReactNode) => (busy === k ? <Loader2 size={15} className="animate-spin" /> : icon);
  const isInvoice = docType === "invoice";
  const items: { key: string; label: string; icon: React.ReactNode; href?: string; onClick?: () => void; danger?: boolean; disabled?: boolean; title?: string }[] = [];
  if (canEdit && status !== "batal") items.push({ key: "edit", label: "Edit", icon: <Pencil size={15} />, href: `/invoice/${id}/edit` });
  if (status === "draft") items.push({ key: "issue", label: "Terbitkan", icon: spin("issue", <Send size={15} />), onClick: () => void run("issue"), disabled: busy !== null });
  if (isInvoice && status === "terbit" && remaining > 0) items.push({ key: "lunas", label: "Tandai Lunas", icon: spin("lunas", <BadgeCheck size={15} />), onClick: () => void run("lunas"), disabled: busy !== null });
  if (isInvoice && status === "terbit" && remaining > 0)
    items.push({
      key: "tagih",
      label: "Tagih",
      icon: <BellRing size={15} />,
      onClick: () => window.dispatchEvent(new Event(OPEN_REMINDER_EVENT)),
      title: "Kirim pengingat tagihan lewat WhatsApp",
    });
  if (!isInvoice && status === "terbit")
    items.push({
      key: "convert",
      label: alreadyConverted ? "Sudah jadi Invoice" : "Jadikan Invoice",
      icon: spin("convert", <FileCheck2 size={15} />),
      onClick: () => void run("convert"),
      disabled: busy !== null || alreadyConverted,
    });
  items.push({ key: "dup", label: "Duplikat", icon: spin("duplicate", <Copy size={15} />), onClick: () => void run("duplicate"), disabled: busy !== null });
  if (status === "draft") items.push({ key: "delete", label: "Hapus draft", icon: spin("delete", <Trash2 size={15} />), onClick: () => void run("delete"), danger: true, disabled: busy !== null });
  if (status === "terbit" && isOwner)
    items.push({
      key: "void",
      label: "Batalkan",
      icon: spin("void", <Ban size={15} />),
      onClick: () => void run("void"),
      danger: true,
      disabled: busy !== null || hasActivePayments,
      title: hasActivePayments ? "Batalkan dulu pembayarannya" : undefined,
    });

  return (
    <div className="space-y-1">
      {layout === "side" ? (
        <div className="space-y-0.5">
          {items.map((i) => (
            <SideButton key={i.key} icon={i.icon} href={i.href} onClick={i.onClick} danger={i.danger} disabled={i.disabled} title={i.title}>
              {i.label}
            </SideButton>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((i) =>
            i.href ? (
              <a key={i.key} href={i.href} className="btn-secondary px-3 py-2 text-xs">{i.icon} {i.label}</a>
            ) : (
              <button key={i.key} type="button" onClick={i.onClick} disabled={i.disabled} title={i.title} className={`${i.danger ? "btn-danger" : "btn-secondary"} px-3 py-2 text-xs`}>
                {i.icon} {i.label}
              </button>
            ),
          )}
        </div>
      )}
      {status === "terbit" && isOwner && hasActivePayments ? <p className="text-[11px] text-slate-400">Untuk membatalkan, batalkan dulu semua pembayarannya.</p> : null}
      {error ? <p className="break-words rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
