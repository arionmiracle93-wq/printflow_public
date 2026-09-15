import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "print_flow_session";
const PUBLIC_PAGES = ["/login", "/setup-akun", "/offline.html"];
const PUBLIC_PREFIXES = ["/lacak/", "/dokumentasi-update/"];
const PUBLIC_API = ["/api/auth/login", "/api/auth/bootstrap", "/api/auth/status", "/api/health", "/api/setup"];
const PUBLIC_API_PREFIXES = ["/api/photos/"];
const OWNER_PAGE_PREFIXES = ["/pengaturan", "/catatan-perubahan", "/panduan", "/status", "/pengguna", "/audit", "/sesi"];
const OWNER_API_PREFIXES = ["/api/admin/", "/api/export", "/api/diagnose", "/api/performance", "/api/users", "/api/sessions"];

function secret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET?.trim() || process.env.DATABASE_URL?.trim() || "print-flow-local-development-only",
  );
}

function isPublic(pathname: string) {
  return PUBLIC_PAGES.includes(pathname) ||
    pathname.startsWith("/.well-known/") ||
    pathname.startsWith("/api/apk/") ||
    pathname.startsWith("/api/pwa/") ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    PUBLIC_API.includes(pathname) ||
    PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE)?.value;
  let session: { role?: string; userId?: number } | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret(), { issuer: "print-flow", audience: "print-flow-internal" });
      session = payload as { role?: string; userId?: number };
    } catch {
      session = null;
    }
  }

  if (isPublic(pathname) || (pathname === "/api/branding/logo" && request.method === "GET")) {
    if ((pathname === "/login" || pathname === "/setup-akun") && session) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) return Response.json({ ok: false, error: "Sesi login diperlukan." }, { status: 401 });
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    const response = NextResponse.redirect(login);
    if (token) response.cookies.delete(COOKIE);
    return response;
  }

  const role = session.role;
  const ownerOnly = OWNER_PAGE_PREFIXES.some((p) => pathname.startsWith(p)) || OWNER_API_PREFIXES.some((p) => pathname.startsWith(p));
  const sensitiveMethod =
    (pathname.match(/^\/api\/orders\/\d+$/) && request.method === "DELETE") ||
    (pathname === "/api/partners" && request.method === "POST") ||
    (pathname === "/api/branding/logo" && request.method !== "GET");
  if ((ownerOnly || sensitiveMethod) && role !== "owner") {
    if (pathname.startsWith("/api/")) return Response.json({ ok: false, error: "Akses ini hanya untuk Owner." }, { status: 403 });
    return NextResponse.redirect(new URL("/tidak-diizinkan", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-print-flow-protected", "1");
  requestHeaders.set("x-print-flow-role", String(role ?? ""));
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|icon-maskable-512.png|apple-touch-icon.png|manifest.webmanifest|sw.js|offline.html).*)",
  ],
};
