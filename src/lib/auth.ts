// Tylko serwer (Node): sesje trzymane w bazie, żeby dało się je odwołać (wylogowanie, zmiana hasła).
// Ciasteczko = podpisany token z `sid`; w bazie jest tylko hash `sid`, więc wyciek bazy nie daje gotowych sesji.
import { cache } from "react";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { q, run } from "./db";
import { USERS, type AppUser, type Role } from "./users";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSessionToken, verifySessionToken } from "./auth-token";

export { SESSION_COOKIE };

const TOUCH_EVERY_MS = 60 * 60 * 1000; // last_seen odświeżamy najwyżej co godzinę

export interface Session {
  username: string;
  displayName: string;
  role: Role;
}

const hashSid = (sid: string) => createHash("sha256").update(sid).digest("hex");

// Zakłada sesję w bazie i ustawia ciasteczko. Wołać z Route Handlera (tylko tam można ustawiać ciasteczka).
export async function startSession(user: AppUser, userAgent: string | null): Promise<void> {
  const sid = randomBytes(32).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_MAX_AGE * 1000);
  await run("DELETE FROM auth_sessions WHERE expires_at < ?", [now.toISOString()]);
  await run(
    `INSERT INTO auth_sessions (id, username, created_at, expires_at, last_seen, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [hashSid(sid), user.username, now.toISOString(), expires.toISOString(), now.toISOString(), userAgent?.slice(0, 200) ?? null]
  );

  const token = await signSessionToken({ username: user.username, sid });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

async function currentClaims() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

// Usuwa bieżącą sesję z bazy i kasuje ciasteczko.
export async function endSession(): Promise<void> {
  const claims = await currentClaims();
  if (claims) await run("DELETE FROM auth_sessions WHERE id = ?", [hashSid(claims.sid)]);
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

// Wylogowuje użytkownika ze wszystkich pozostałych urządzeń (np. po zmianie hasła).
export async function endOtherSessions(username: string): Promise<void> {
  const claims = await currentClaims();
  await run("DELETE FROM auth_sessions WHERE username = ? AND id <> ?", [username, claims ? hashSid(claims.sid) : ""]);
}

// Do użycia w Server Components / Route Handlers. cache() = jedno zapytanie do bazy na żądanie.
export const getSession = cache(async (): Promise<Session | null> => {
  const claims = await currentClaims();
  if (!claims) return null;

  const id = hashSid(claims.sid);
  const rows = await q<{ username: string; expires_at: string; last_seen: string }>(
    "SELECT username, expires_at, last_seen FROM auth_sessions WHERE id = ?",
    [id]
  );
  const row = rows[0];
  const now = Date.now();
  if (!row || row.username !== claims.username || Date.parse(row.expires_at) < now) return null;

  // Rola i nazwa zawsze z listy kont, nie z tokenu
  const user = USERS.find((u) => u.username === row.username);
  if (!user) return null;

  if (now - Date.parse(row.last_seen) > TOUCH_EVERY_MS) {
    await run("UPDATE auth_sessions SET last_seen = ? WHERE id = ?", [new Date(now).toISOString(), id]);
  }
  return { username: user.username, displayName: user.displayName, role: user.role };
});

// Wyrzuca, jeśli brak sesji — wygodne w API.
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHORIZED");
  return s;
}
