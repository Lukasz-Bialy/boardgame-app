// Podpisany token sesji — bez bazy i bez node:crypto, więc działa też w middleware (Edge).
// Sam podpis nie wystarcza: getSession() w auth.ts sprawdza jeszcze, czy sesja `sid` istnieje w bazie.
import { SignJWT, jwtVerify } from "jose";

const IS_PROD = process.env.NODE_ENV === "production";
// Wartości jawne (w repo) — na produkcji nie mogą podpisywać sesji
const KNOWN_SECRETS = ["dev-secret-change-me", "zmien-mnie-na-dlugi-losowy-ciag"];
const MIN_SECRET_LENGTH = 32;

const ISSUER = "planszowki";
const AUDIENCE = "planszowki-session";

// __Host- wymusza Secure, path=/ i brak Domain — subdomena nie podrzuci własnego ciasteczka
export const SESSION_COOKIE = IS_PROD ? "__Host-session" : "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dni

let secret: Uint8Array | null = null;

// Leniwie, żeby brak sekretu nie wywalał `next build`; przy użyciu na produkcji — twardy błąd
function getSecret(): Uint8Array {
  if (secret) return secret;
  const raw = process.env.AUTH_SECRET ?? "";
  if (IS_PROD && (raw.length < MIN_SECRET_LENGTH || KNOWN_SECRETS.includes(raw))) {
    throw new Error(`AUTH_SECRET musi mieć co najmniej ${MIN_SECRET_LENGTH} losowych znaków (openssl rand -base64 32)`);
  }
  secret = new TextEncoder().encode(raw || "dev-secret-change-me");
  return secret;
}

export interface TokenClaims {
  username: string;
  sid: string; // losowy identyfikator sesji, w bazie trzymany jako hash
}

export async function signSessionToken({ username, sid }: TokenClaims): Promise<string> {
  return await new SignJWT({ sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(username)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<TokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
    return { username: payload.sub, sid: payload.sid };
  } catch {
    return null;
  }
}
