export const dynamic = "force-dynamic";

type CheckResult = {
  name: string;
  path: string;
  ok: boolean;
  status: number;
  contentType?: string | null;
  location?: string | null;
  protected?: boolean;
  error?: string;
};

function looksLikeVercelProtection(status: number, location: string | null) {
  if (![302, 307, 308, 401, 403].includes(status)) return false;
  const value = (location ?? "").toLowerCase();
  return (
    value.includes("vercel") ||
    value.includes("sso") ||
    value.includes("auth") ||
    value.includes("login") ||
    status === 401 ||
    status === 403
  );
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const targets = [
    ["manifest", "/api/pwa/manifest"],
    ["serviceWorker", "/sw.js"],
    ["icon192Dynamic", "/api/pwa/icon/192.png"],
    ["icon512Dynamic", "/api/pwa/icon/512.png"],
    ["icon192Static", "/icon-192.png"],
    ["icon512Static", "/icon-512.png"],
    ["iconMaskableStatic", "/icon-maskable-512.png"],
  ] as const;

  // Sengaja tidak meneruskan cookie. PWABuilder/crawler juga datang tanpa
  // cookie login Vercel; diagnosis harus menguji akses publik yang sebenarnya.
  const checks: CheckResult[] = await Promise.all(
    targets.map(async ([name, path]) => {
      try {
        const response = await fetch(`${origin}${path}`, {
          cache: "no-store",
          redirect: "manual",
          headers: { "User-Agent": "PrintFlow-PWA-Public-Check/1.0" },
        });
        const location = response.headers.get("location");
        return {
          name,
          path,
          ok: response.ok,
          status: response.status,
          contentType: response.headers.get("content-type"),
          location,
          protected: looksLikeVercelProtection(response.status, location),
        };
      } catch (error) {
        return {
          name,
          path,
          ok: false,
          status: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const essentialNames = ["manifest", "serviceWorker", "icon192Dynamic", "icon512Dynamic"];
  const essential = checks.filter((item) => essentialNames.includes(item.name));
  const ready = essential.every((item) => item.ok);
  const redirects = essential.filter((item) => [302, 307, 308].includes(item.status));
  const protectedDeployment = redirects.length >= 2 || essential.some((item) => item.protected);

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || null;
  const productionUrl = productionHost ? `https://${productionHost}` : null;
  const currentHost = requestUrl.host;
  const likelyDeploymentUrl = Boolean(
    process.env.VERCEL_URL && currentHost === process.env.VERCEL_URL,
  );

  const message = ready
    ? "Infrastruktur PWA publik siap. Manifest, service worker, dan ikon dapat diakses tanpa cookie."
    : protectedDeployment
      ? "Aset PWA ada, tetapi domain ini dilindungi Vercel Deployment Protection (request anonim mendapat redirect 302). Gunakan Production Domain yang publik atau nonaktifkan protection untuk domain production."
      : "Ada aset PWA utama yang belum dapat diakses secara publik.";

  return Response.json({
    ok: ready,
    code: ready ? "ready" : protectedDeployment ? "vercel_deployment_protected" : "asset_unavailable",
    message,
    currentUrl: origin,
    currentHost,
    vercelEnvironment: process.env.VERCEL_ENV || null,
    likelyDeploymentUrl,
    recommendedProductionUrl: productionUrl,
    pageManifestUrl: `${origin}/api/pwa/manifest`,
    checks,
    nextSteps: ready
      ? ["Gunakan currentUrl pada PWABuilder."]
      : protectedDeployment
        ? [
            "Vercel → Project → Settings → Deployment Protection.",
            "Pastikan Production Domain tidak dilindungi (Preview boleh tetap dilindungi).",
            productionUrl
              ? `Coba buka Production Domain: ${productionUrl}/api/pwa/check`
              : "Vercel → Project → Settings → Domains: salin domain yang berlabel Production.",
            "Buka /api/pwa/check pada Production Domain; hasil harus ok:true.",
            "Masukkan Production Domain tersebut ke PWABuilder, bukan URL deployment dengan akhiran acak.",
          ]
        : [
            "Pastikan deployment terbaru berstatus Ready.",
            "Pastikan route manifest/icon/sw.js ikut ter-upload ke GitHub.",
            "Buka setiap path pada checks dan periksa statusnya.",
          ],
    explanation:
      "Ikon yang bisa dibuka di browser login Vercel belum tentu publik. PWABuilder dan OS Android mengambil manifest/icon tanpa cookie Vercel.",
    testedAt: new Date().toISOString(),
  });
}
