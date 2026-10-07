import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];
// Strona startowa jest publiczna tylko pod dokładnym adresem "/" (zalogowanych przekierowuje na pulpit).
const PUBLIC_EXACT = ["/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isPublic =
    PUBLIC_EXACT.includes(pathname) || PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // Zalogowany na stronie logowania -> przekieruj na pulpit.
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (isPublic) return NextResponse.next();

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Wymagane logowanie" }, { status: 401 });
    }
    // Logowanie wysuwa się z landingu — /?login otwiera panel
    const url = new URL("/", req.url);
    url.searchParams.set("login", "");
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Pomijamy zasoby statyczne Next.js i pliki publiczne.
  // icon.svg = ikona karty (src/app/icon.svg) — musi być dostępna bez logowania, także na landingu
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
