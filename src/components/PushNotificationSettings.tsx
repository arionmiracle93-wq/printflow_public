"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Bell, BellOff, Check, CheckCircle2, Copy, KeyRound, RefreshCw, Send, ShieldAlert } from "lucide-react";

function base64Key(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function keyFromSubscription(subscription: PushSubscription) {
  const key = subscription.options.applicationServerKey;
  if (!key) return "";
  const bytes = new Uint8Array(key);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

type PushStatus = {
  configured: boolean;
  publicKey: string | null;
  subscriptions: number;
  mySubscriptions: number;
};

type GeneratedKeys = {
  publicKey: string;
  privateKey: string;
};

export function PushNotificationSettings() {
  const [supported, setSupported] = useState(true);
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<ReactNode | null>(null);
  const [generated, setGenerated] = useState<GeneratedKeys | null>(null);
  const [workerVersion, setWorkerVersion] = useState<string>("belum terbaca");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function refreshStatus() {
    const can = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(can);
    if (!can) return;
    setPermission(Notification.permission);
    try {
      const [api, registration, workerText] = await Promise.all([
        fetch("/api/push", { cache: "no-store" }).then((r) => r.json()) as Promise<PushStatus & { ok?: boolean }>,
        navigator.serviceWorker.ready,
        fetch(`/sw.js?check=${Date.now()}`, { cache: "no-store" }).then((response) => response.text()),
      ]);
      setStatus(api);
      setWorkerVersion(workerText.match(/print-flow-shell-v\d+/)?.[0] ?? "versi tidak ditemukan");
      setSubscribed(Boolean(await registration.pushManager.getSubscription()));
    } catch {
      setMessage("Tidak dapat memeriksa status notifikasi.");
    }
  }

  useEffect(() => { void refreshStatus(); }, []);

  async function generateKeys() {
    setBusy(true); setMessage(null); setGenerated(null);
    try {
      const res = await fetch("/api/push/vapid-helper", { method: "POST" });
      const json = (await res.json()) as { ok?: boolean; publicKey?: string; privateKey?: string; error?: string };
      if (!json.ok || !json.publicKey || !json.privateKey) {
        setMessage(json.error ?? "Gagal membuat VAPID key.");
        return;
      }
      setGenerated({ publicKey: json.publicKey, privateKey: json.privateKey });
      setMessage("Kunci berhasil dibuat. Salin ketiga variable ke Vercel sekarang—private key tidak disimpan.");
    } catch {
      setMessage("Tidak dapat membuat VAPID key.");
    } finally { setBusy(false); }
  }

  async function copy(name: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(name);
    window.setTimeout(() => setCopied(null), 1800);
  }

  async function copyAll() {
    if (!generated) return;
    const subject = `mailto:${email.trim() || "GANTI-DENGAN-EMAIL-ANDA"}`;
    await copy("all", [
      `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${generated.publicKey}`,
      `VAPID_PRIVATE_KEY=${generated.privateKey}`,
      `VAPID_SUBJECT=${subject}`,
    ].join("\n"));
  }

  async function enable() {
    setBusy(true); setMessage(null);
    try {
      const publicKey = status?.publicKey;
      if (!status?.configured || !publicKey) {
        setMessage("VAPID belum aktif di Vercel. Selesaikan Tahap 1 dan Redeploy terlebih dahulu.");
        return;
      }
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        setMessage("Izin belum diberikan. Aktifkan melalui Settings Android/Chrome → Notifications.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (subscription && keyFromSubscription(subscription) !== publicKey) {
        await subscription.unsubscribe();
        subscription = null;
      }
      subscription ??= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64Key(publicKey),
      });
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          subscription: subscription.toJSON(),
          deviceName: navigator.userAgent.includes("Android") ? "Android / APK" : "Browser / Desktop",
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!json.ok) {
        setMessage(json.error ?? "Gagal menyimpan subscription.");
        return;
      }
      setSubscribed(true);
      await refreshStatus();
      setMessage(
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 size={13} className="shrink-0" /> Perangkat aktif. Tekan Uji Notifikasi untuk memastikan panel Android bekerja.
        </span>,
      );
    } catch {
      setMessage("Gagal mengaktifkan notifikasi. Pastikan memakai HTTPS dan Chrome/Edge terbaru.");
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unsubscribe", subscription: subscription.toJSON() }),
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      await refreshStatus();
      setMessage("Notifikasi dinonaktifkan pada perangkat ini.");
    } finally { setBusy(false); }
  }

  async function testLocal() {
    setBusy(true);
    setMessage(null);
    try {
      if (Notification.permission !== "granted") {
        setMessage("Uji lokal gagal: izin Android belum granted. Aktifkan izin notifikasi terlebih dahulu.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("Uji Lokal Print Flow", {
        body: "Jika pesan ini terlihat, izin Android dan service worker berfungsi.",
        tag: `local-test-${Date.now()}`,
        requireInteraction: true,
        data: { url: "/notifikasi" },
      });
      setMessage(
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 size={13} className="shrink-0" /> Uji lokal diperintahkan ke Android. Minimize APK dan lihat panel notifikasi. Jika tidak muncul, cek izin aplikasi/Chrome dan Do Not Disturb.
        </span>,
      );
    } catch (error) {
      setMessage(`Uji lokal gagal: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function repairSubscription() {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const oldSubscription = await registration.pushManager.getSubscription();
      if (oldSubscription) await oldSubscription.unsubscribe();
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-mine" }),
      });
      await registration.update();
      setSubscribed(false);
      await refreshStatus();
      setMessage("Subscription lama sudah dibersihkan. Sekarang tekan Aktifkan Notifikasi, lalu Uji Lokal dan Uji Push Server.");
    } catch (error) {
      setMessage(`Gagal memperbaiki subscription: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true); setMessage(null);
    try {
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        attempted?: number;
        sent?: number;
        failed?: number;
        removed?: number;
        error?: string;
        errors?: Array<{ statusCode: number | null; message: string; deviceName: string | null }>;
      };
      if (json.ok) {
        setMessage(
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={13} className="shrink-0" /> Push server diterima layanan push: {json.sent}/{json.attempted} perangkat. Minimize APK lalu cek panel Android.
          </span>,
        );
      } else {
        const detail = json.errors?.map((item) => `[${item.statusCode ?? "?"}] ${item.message}`).join(" · ");
        setMessage(`${json.error ?? "Notifikasi uji gagal."}${detail ? ` Detail: ${detail}` : ""}${json.removed ? ` Subscription kedaluwarsa dihapus: ${json.removed}.` : ""}`);
      }
    } finally { setBusy(false); }
  }

  const configured = Boolean(status?.configured);

  return (
    <div className="card min-w-0 max-w-full overflow-hidden p-4">
      <div className="flex items-start gap-3">
        <span className="icon-tile"><Bell size={18} /></span>
        <div className="min-w-0">
          <h3 className="break-words text-sm font-extrabold text-[#07384f]">Push Notification Android / PWA</h3>
          <p className="mt-0.5 text-xs text-slate-500">Selesaikan tiga tahap di bawah satu kali per perangkat.</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <section className={`rounded-xl border p-3 ${configured ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}`}>
          <div className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black ${configured ? "bg-emerald-500 text-white" : "bg-amber-400 text-[#07384f]"}`}>{configured ? <Check size={14} /> : "1"}</span>
            <p className="text-xs font-extrabold text-[#07384f]">Konfigurasi VAPID di Vercel</p>
          </div>
          {configured ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 size={13} className="shrink-0" /> VAPID server sudah aktif. Jangan mengganti key agar subscription lama tetap berlaku.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-amber-900">Buat key, lalu salin ke Vercel → Settings → Environment Variables → Redeploy.</p>
              {!generated ? (
                <button type="button" onClick={generateKeys} disabled={busy} className="btn-primary w-full sm:w-auto"><KeyRound size={15} /> Buat VAPID Key</button>
              ) : (
                <div className="space-y-2 rounded-xl bg-white p-2.5">
                  <KeyRow name="NEXT_PUBLIC_VAPID_PUBLIC_KEY" value={generated.publicKey} onCopy={copy} copied={copied} />
                  <KeyRow name="VAPID_PRIVATE_KEY" value={generated.privateKey} onCopy={copy} copied={copied} secret />
                  <label className="block"><span className="label">Email VAPID</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email-owner@gmail.com" className="input" /></label>
                  <button type="button" onClick={copyAll} className="btn-secondary w-full"><Copy size={14} /> {copied === "all" ? "Tersalin!" : "Salin Semua Variable"}</button>
                  <p className="text-[10px] font-semibold text-rose-600"><ShieldAlert size={11} className="mr-1 inline" />Jangan simpan private key di GitHub, screenshot publik, atau grup WhatsApp.</p>
                </div>
              )}
            </div>
          )}
        </section>

        <section className={`rounded-xl border p-3 ${subscribed ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50"}`}>
          <div className="flex items-center gap-2"><span className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black ${subscribed ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"}`}>{subscribed ? <Check size={14} /> : "2"}</span><p className="text-xs font-extrabold text-[#07384f]">Aktifkan pada perangkat ini</p></div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">Status izin: <strong>{permission}</strong> · perangkat akun ini: <strong>{status?.mySubscriptions ?? 0}</strong> · semua perangkat: <strong>{status?.subscriptions ?? 0}</strong> · service worker: <strong>{workerVersion}</strong></p>
          <div className="mt-2 grid gap-2 sm:flex sm:flex-wrap">
            {!subscribed ? <button type="button" onClick={enable} disabled={busy || !supported || !configured} className="btn-primary w-full sm:w-auto"><Bell size={15} /> Aktifkan Notifikasi</button> : <button type="button" onClick={disable} disabled={busy} className="btn-ghost w-full sm:w-auto"><BellOff size={15} /> Nonaktifkan</button>}
            <button type="button" onClick={() => void refreshStatus()} disabled={busy} className="btn-ghost w-full sm:w-auto"><RefreshCw size={14} /> Periksa Ulang</button>
            <button type="button" onClick={repairSubscription} disabled={busy || !configured} className="btn-danger w-full sm:w-auto"><RefreshCw size={14} /> Perbaiki Subscription</button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-200 text-xs font-black text-slate-600">3</span><p className="text-xs font-extrabold text-[#07384f]">Diagnosis dua tahap</p></div>
          <p className="mt-2 text-xs text-slate-600"><strong>Uji Lokal</strong> memeriksa izin Android + service worker. <strong>Uji Push Server</strong> memeriksa jalur Vercel + VAPID + Neon + layanan push.</p>
          <div className="mt-2 grid gap-2 sm:flex sm:flex-wrap">
            <button type="button" onClick={testLocal} disabled={busy || permission !== "granted"} className="btn-ghost w-full sm:w-auto"><Bell size={15} /> Uji Lokal</button>
            <button type="button" onClick={test} disabled={busy || !subscribed || !configured} className="btn-secondary w-full sm:w-auto"><Send size={15} /> Uji Push Server</button>
          </div>
        </section>
      </div>

      {!supported ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">Browser/perangkat ini tidak mendukung Web Push.</p> : null}
      {permission === "denied" ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">Izin pernah ditolak. Android Settings → Apps → Chrome/Print Flow → Notifications → Allow.</p> : null}
      {message ? <p className="mt-3 break-words rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{message}</p> : null}
    </div>
  );
}

function KeyRow({ name, value, copied, onCopy, secret = false }: { name: string; value: string; copied: string | null; onCopy: (name: string, value: string) => Promise<void>; secret?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-2">
      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{name}</p>
      <div className="mt-1 flex min-w-0 items-center gap-2"><code className="min-w-0 flex-1 truncate text-[10px] text-slate-600">{secret ? `${value.slice(0, 6)}••••••${value.slice(-4)}` : value}</code><button type="button" onClick={() => void onCopy(name, value)} className="shrink-0 rounded-lg bg-white p-2 text-teal-700 shadow-sm" aria-label={`Salin ${name}`}>{copied === name ? <Check size={14} /> : <Copy size={14} />}</button></div>
    </div>
  );
}
