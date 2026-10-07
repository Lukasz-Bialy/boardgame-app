import { NextResponse, type NextRequest } from "next/server";
// Middleware działa na Edge — sprawdza tylko podpis tokenu. Czy sesja nie została odwołana,
// sprawdza getSession() (layout aplikacji i withAuth w API).
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth-token";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];
// Strona startowa jest publiczna tylko pod dokładnym adresem "/" (zalogowanych przekierowuje na pulpit).
const PUBLIC_EXACT = ["/"];
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

// Ochrona przed CSRF: zapytanie zmieniające dane musi przyjść z naszej własnej strony
function isCrossSite(req: NextRequest): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/") && !SAFE_METHODS.includes(req.method) && isCrossSite(req)) {
    return NextResponse.json({ error: "Niedozwolone źródło żądania" }, { status: 403 });
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isPublic =
    PUBLIC_EXACT.includes(pathname) || PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // Zalogowanych z landingu przekierowuje sama strona "/" (getSession sprawdza też bazę) —
  // tutaj tego nie robimy, bo odwołana sesja z ważnym podpisem dałaby pętlę przekierowań.
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
