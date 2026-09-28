import { NextResponse } from "next/server";
import { findUserByLogin } from "@/lib/users";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { checkPassword } from "@/lib/passwords";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "");
  const password = String(body?.password ?? "");

  const user = findUserByLogin(username);
  if (!user || !(await checkPassword(user, password))) {
    return NextResponse.json({ error: "Nieprawidłowy login lub hasło" }, { status: 401 });
  }

  const token = await createSessionToken(user);
  await setSessionCookie(token);
  return NextResponse.json({
    ok: true,
    user: { username: user.username, displayName: user.displayName, role: user.role },
  });
}
