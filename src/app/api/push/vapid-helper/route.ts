import webpush from "web-push";
import { getCurrentUser } from "@/lib/auth";
import { pushConfig } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * Membuat VAPID key sekali untuk disalin Owner ke Vercel.
 * Private key hanya dikirim pada response ini—tidak disimpan/log/database.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (user?.role !== "owner") {
    return Response.json({ ok: false, error: "Hanya Owner yang dapat membuat VAPID key." }, { status: 403 });
  }
  if (pushConfig().ready) {
    return Response.json(
      { ok: false, error: "VAPID sudah aktif. Jangan membuat key baru karena perangkat lama harus berlangganan ulang." },
      { status: 409 },
    );
  }

  const keys = webpush.generateVAPIDKeys();
  return Response.json(
    {
      ok: true,
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      variables: {
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: keys.publicKey,
        VAPID_PRIVATE_KEY: keys.privateKey,
        VAPID_SUBJECT: "mailto:GANTI-DENGAN-EMAIL-ANDA",
      },
      warning: "Salin sekarang ke Vercel. Private key tidak disimpan oleh Print Flow dan tidak dapat ditampilkan ulang.",
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } },
  );
}
