import { pushConfig } from "@/lib/push";

export const dynamic = "force-dynamic";

function certs() {
  const raw = process.env.ANDROID_SHA256_CERT_FINGERPRINTS?.trim() ||
    process.env.ANDROID_SHA256_CERT_FINGERPRINT?.trim() || "";
  return raw.split(/[\n,;]+/).map((value) => value.trim().toUpperCase()).filter(Boolean);
}

async function publicCheck(origin: string, path: string) {
  try {
    const response = await fetch(`${origin}${path}`, {
      cache: "no-store",
      redirect: "manual",
      headers: { "User-Agent": "PrintFlow-APK-Readiness/1.0" },
    });
    return {
      path,
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type"),
      redirect: response.headers.get("location"),
    };
  } catch (error) {
    return { path, ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim() || "";
  const fingerprints = certs();
  const push = pushConfig();
  const [assetlinks, manifest, worker, icon] = await Promise.all([
    publicCheck(origin, "/.well-known/assetlinks.json"),
    publicCheck(origin, "/api/pwa/manifest"),
    publicCheck(origin, "/sw.js"),
    publicCheck(origin, "/api/pwa/icon/512.png"),
  ]);

  const twaConfigured = Boolean(packageName && fingerprints.length);
  const twaPublic = twaConfigured && assetlinks.ok;
  const pwaReady = manifest.ok && worker.ok && icon.ok;
  const pushReady = push.ready && worker.ok;
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || null;

  return Response.json({
    ok: twaPublic && pwaReady,
    addressBar: {
      ready: twaPublic,
      reason: !twaConfigured
        ? "ANDROID_PACKAGE_NAME dan/atau SHA-256 fingerprint belum diisi di Vercel. TWA belum terverifikasi, sehingga tampil sebagai Custom Tab dengan address bar."
        : !assetlinks.ok
          ? `assetlinks.json tidak dapat diakses publik (status ${assetlinks.status}).`
          : "Konfigurasi website siap. Jika address bar masih muncul, fingerprint/package APK tidak cocok atau APK perlu di-install ulang setelah verifikasi.",
      packageName: packageName || null,
      fingerprints,
      assetlinksUrl: `${origin}/.well-known/assetlinks.json`,
      check: assetlinks,
    },
    pushNotification: {
      infrastructureReady: pushReady,
      vapidConfigured: push.ready,
      serviceWorkerReady: worker.ok,
      note: pushReady
        ? "Infrastruktur siap. Setiap perangkat tetap harus login → Pengaturan → Aktifkan Notifikasi → Izinkan → Uji Notifikasi."
        : "Isi NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, dan VAPID_SUBJECT di Vercel lalu Redeploy.",
    },
    pwa: { ready: pwaReady, manifest, serviceWorker: worker, icon512: icon },
    currentUrl: origin,
    recommendedProductionUrl: productionHost ? `https://${productionHost}` : null,
    nextSteps: [
      "Isi ANDROID_PACKAGE_NAME dan ANDROID_SHA256_CERT_FINGERPRINT(S) di Vercel.",
      "Redeploy lalu buka /.well-known/assetlinks.json — harus berisi package dan fingerprint, bukan [].",
      "Pastikan URL assetlinks dapat dibuka pada Incognito tanpa redirect.",
      "Uninstall APK lama, install ulang APK signed yang fingerprint-nya sama, lalu buka lagi.",
      "Untuk push: aktifkan dan uji dari Pengaturan pada perangkat Android.",
    ],
    testedAt: new Date().toISOString(),
  });
}
