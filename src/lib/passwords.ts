// Tylko serwer: hasła zmienione przez użytkowników trzymamy w bazie jako hash scrypt z losową solą.
// Dopóki ktoś nie zmieni hasła, obowiązuje domyślne z src/lib/users.ts (lub zmiennej środowiskowej).
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { q, run } from "./db";
import type { AppUser } from "./users";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LEN = 64;

export const MIN_PASSWORD_LENGTH = 6;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyHash(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, keyHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const key = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(key, expected);
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function checkPassword(user: AppUser, password: string): Promise<boolean> {
  const rows = await q<{ hash: string }>("SELECT hash FROM user_passwords WHERE username = ?", [user.username]);
  if (rows[0]) return verifyHash(password, rows[0].hash);
  // Puste hasło startowe = brak PW_* na produkcji → konto zablokowane
  return user.password !== "" && safeEqual(password, user.password);
}

export async function setPassword(username: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  await run(
    `INSERT INTO user_passwords (username, hash, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET hash = excluded.hash, updated_at = excluded.updated_at`,
    [username, hash, new Date().toISOString()]
  );
}
