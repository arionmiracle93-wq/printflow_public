import { getCurrentUser, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * PERPANJANG SESI YANG SEDANG BERJALAN
 * ===================================================================
 * Token sesi punya umur tetap 12 jam yang dihitung sejak login:
 *
 *   .setExpirationTime("12h")     src/lib/auth.ts
 *   maxAge: 60 * 60 * 12          src/lib/auth.ts
 *
 * Dan token itu tidak pernah diperpanjang. setSessionCookie hanya
 * dipanggil sekali, di /api/auth/login. Permintaan lain ke server
 * cuma meng-update kolom lastSeenAt - mencatat orangnya masih ada,
 * tapi tidak menerbitkan token baru.
 *
 * Akibatnya: tepat 12 jam setelah login, orang ter-logout
 * sementara halamannya masih terbuka. Di web hampir tidak terasa
 * karena peramban menyimpan password, jadi "login lagi" cuma satu
 * klik. Di APK tidak ada password manager, jadi logout terasa
 * sebagai gangguan mendadak.
 *
 * APA YANG DILAKUKAN
 * Kalau sesi masih sah, cookie diterbitkan ulang dengan jendela 12
 * jam baru. Session life berubah dari "logout 12 jam SETELAH
 * login" menjadi "logout 12 jam SETELAH aktivitas terakhir" -
 * yang kedua itulah yang diharapkan orang dari sebuah login.
 *
 * KENAPA DI DALAM ROUTE HANDLER
 * Set-Cookie hanya boleh dikirim dari Route Handler atau Server
 * Action. src/proxy.ts tidak boleh disentuh, dan komponen server
 * biasa tidak bisa menulis cookie.
 *
 * KENAPA SENGAJA TIDAK PUBLIK
 * Route ini tidak masuk PUBLIC_API di proxy.ts, jadi ikut dijaga.
 * Kalau sesi sudah tidak sah, jawabannya 401 - dan itu benar.
 * Jangan diubah jadi publik: kalau begitu route ini bisa dipanggil
 * siapa saja tanpa sesi dan hanya memboroskan sumber daya.
 *
 * CATATAN KEAMANAN
 * Route ini hanya memperpanjang sesi yang sudah ada. Ia tidak
 * membuat sesi baru, tidak menerima username/password, dan tidak
 * menebak siapa pun. Tanpa cookie yang sah, jawabannya 401.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ ok: false, error: "Sesi login tidak berlaku." }, { status: 401 });
    await setSessionCookie(user);
    return Response.json({ ok: true });
  } catch (error) {
    // Sengaja tidak dilempar: route ini dipanggil diam-diam di
    // latar belakang. Permintaan halaman berikutnya yang akan
    // memberi tahu, dengan pesan yang jauh lebih berguna.
    console.error("Session refresh failed", error);
    return Response.json({ ok: false, error: "Gagal memperpanjang sesi." }, { status: 500 });
  }
}