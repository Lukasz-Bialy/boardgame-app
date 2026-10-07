// Tylko serwer: limit nieudanych logowań (na konto i na IP), żeby nie dało się zgadywać haseł.
import { q, run } from "./db";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_USER = 5;
const MAX_PER_IP = 20;

const userKey = (username: string) => `u:${username.trim().toLowerCase()}`;
const ipKey = (ip: string) => `ip:${ip}`;

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

async function failures(key: string, since: string): Promise<number> {
  const rows = await q<{ n: number }>("SELECT COUNT(*) AS n FROM login_attempts WHERE key = ? AND at >= ?", [key, since]);
  return Number(rows[0]?.n ?? 0);
}

export async function isLoginBlocked(username: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const [byUser, byIp] = await Promise.all([failures(userKey(username), since), failures(ipKey(ip), since)]);
  return byUser >= MAX_PER_USER || byIp >= MAX_PER_IP;
}

export async function recordLoginFailure(username: string, ip: string): Promise<void> {
  const now = new Date();
  await run("DELETE FROM login_attempts WHERE at < ?", [new Date(now.getTime() - WINDOW_MS).toISOString()]);
  for (const key of [userKey(username), ipKey(ip)]) {
    await run("INSERT INTO login_attempts (key, at) VALUES (?, ?)", [key, now.toISOString()]);
  }
}

export async function clearLoginFailures(username: string): Promise<void> {
  await run("DELETE FROM login_attempts WHERE key = ?", [userKey(username)]);
}
