export const dynamic = "force-dynamic";

function fingerprints() {
  const raw = process.env.ANDROID_SHA256_CERT_FINGERPRINTS?.trim() ||
    process.env.ANDROID_SHA256_CERT_FINGERPRINT?.trim() || "";
  return raw
    .split(/[\n,;]+/)
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Digital Asset Links untuk verifikasi Trusted Web Activity.
 * Android mewajibkan URL ini publik, HTTPS, application/json, tanpa redirect.
 */
export async function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim() || "";
  const certs = fingerprints();

  const statements = packageName && certs.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: packageName,
            sha256_cert_fingerprints: certs,
          },
        },
      ]
    : [];

  return Response.json(statements, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
