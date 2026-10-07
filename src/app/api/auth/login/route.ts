import { NextResponse } from "next/server";
import { findUserByLogin } from "@/lib/users";
import { startSession } from "@/lib/auth";
import { checkPassword } from "@/lib/passwords";
import { clientIp, isLoginBlocked, recordLoginFailure, clearLoginFailures } from "@/lib/login-limit";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").slice(0, 64);
  const password = String(body?.password ?? "").slice(0, 256);
  const ip = clientIp(req);

  if (await isLoginBlocked(username, ip)) {
    return NextResponse.json({ error: "Za dużo nieudanych prób. Spróbuj ponownie za kilkanaście minut." }, { status: 429 });
  }

  const user = findUserByLogin(username);
  if (!user || !(await checkPassword(user, password))) {
    await recordLoginFailure(username, ip);
    return NextResponse.json({ error: "Nieprawidłowy login lub hasło" }, { status: 401 });
  }

  await clearLoginFailures(username);
  await startSession(user, req.headers.get("user-agent"));
  return NextResponse.json({
    ok: true,
    user: { username: user.username, displayName: user.displayName, role: user.role },
  });
}
