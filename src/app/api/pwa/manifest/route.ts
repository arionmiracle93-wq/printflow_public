export const dynamic = "force-dynamic";

export async function GET() {
  const manifest = {
    id: "/",
    name: "Print Flow — Monitoring Produksi Percetakan",
    short_name: "Print Flow",
    description: "Pantau status pekerjaan percetakan, operator, shift, pelanggan, dan produksi mitra.",
    lang: "id-ID",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait-primary",
    background_color: "#f4f9f9",
    theme_color: "#07384f",
    categories: ["business", "productivity", "utilities"],
    icons: [
      { src: "/api/pwa/icon/192.png?v=printer-1", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/pwa/icon/512.png?v=printer-1", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/api/pwa/icon/512.png?maskable=1&v=printer-1", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/api/pwa/badge/96.png?v=printer-mono-1", sizes: "96x96", type: "image/png", purpose: "monochrome" },
      { src: "/api/pwa/badge/192.png?v=printer-mono-1", sizes: "192x192", type: "image/png", purpose: "monochrome" },
    ],
    shortcuts: [
      {
        name: "Pekerjaan Baru",
        short_name: "Order Baru",
        url: "/pesanan/baru",
        icons: [{ src: "/api/pwa/icon/192.png?v=printer-1", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Daftar Pekerjaan",
        short_name: "Pekerjaan",
        url: "/pesanan",
        icons: [{ src: "/api/pwa/icon/192.png?v=printer-1", sizes: "192x192", type: "image/png" }],
      },
    ],
    launch_handler: { client_mode: "navigate-existing" },
    prefer_related_applications: false,
  };

  return Response.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
