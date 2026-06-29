import { NextResponse } from "next/server";
import { getSession, type Session } from "@/lib/auth";

export async function withAuth(
  handler: (session: Session) => Promise<NextResponse>
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Wymagane logowanie" }, { status: 401 });
  try {
    return await handler(session);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}

export async function withAdmin(
  handler: (session: Session) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(async (session) => {
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Tylko administrator może to zrobić" }, { status: 403 });
    }
    return handler(session);
  });
}

export const ok = (data: unknown = { ok: true }) => NextResponse.json(data);
export const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });
