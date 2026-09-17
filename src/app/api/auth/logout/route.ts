import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser, revokeSession } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (user) await revokeSession(user.sessionId);
  await clearSessionCookie();
  return Response.json({ ok: true });
}

/**
 * Logout lewat GET — dipakai sebagai TUJUAN REDIRECT, bukan tombol.
 *
 * Kenapa perlu ada:
 * Cookie sesi berisi JWT yang ditandatangani dan berlaku 12 jam. Kalau owner
 * me-reset password / menonaktifkan / mengubah role seorang pengguna,
 * tokenVersion di database naik, tapi JWT di perangkat pengguna itu MASIH
 * valid secara tanda tangan sampai 12 jam ke depan.
 *
 * Akibatnya dulu terjadi lingkaran setan:
 *   1. Pengguna membuka halaman mana pun
 *   2. Middleware melihat JWT-nya valid -> dipersilakan lewat
 *   3. Layout memeriksa ke database -> tokenVersion tidak cocok -> redirect /login
 *   4. Middleware melihat JWT masih valid -> "sudah login" -> redirect balik ke /
 *   5. Kembali ke langkah 2 ... berputar terus sampai browser menyerah
 *
 * Halaman ini memutus lingkaran itu: cookie basi DIHAPUS lebih dulu, baru
 * diarahkan ke /login. Karena cookie sudah tidak ada, middleware tidak lagi
 * menganggap pengguna sedang login.
 *
 * Parameter `alasan` diteruskan ke halaman login supaya pengguna diberi tahu
 * kenapa tiba-tiba diminta login lagi, bukan sekadar terlempar tanpa penjelasan.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const alasan = url.searchParams.get("alasan");

  await clearSessionCookie();

  const login = new URL("/login", url.origin);
  if (alasan) login.searchParams.set("alasan", alasan);

  const response = NextResponse.redirect(login);
  // Cookie dihapus di dua tempat sekaligus: lewat helper (agar atributnya
  // konsisten dengan tempat lain) dan langsung di response ini, supaya
  // benar-benar ikut terkirim bersama redirect dan tidak tertinggal di browser.
  response.cookies.delete("print_flow_session");
  return response;
}
