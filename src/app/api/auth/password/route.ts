import { withAuth, ok, bad } from "@/lib/api";
import { endOtherSessions } from "@/lib/auth";
import { findUserByLogin } from "@/lib/users";
import { checkPassword, setPassword, MIN_PASSWORD_LENGTH } from "@/lib/passwords";

export async function POST(req: Request) {
  return withAuth(async (session) => {
    const body = await req.json().catch(() => null);
    const current = String(body?.currentPassword ?? "");
    const next = String(body?.newPassword ?? "");

    const user = findUserByLogin(session.username);
    if (!user) return bad("Nie znaleziono użytkownika", 404);
    if (!(await checkPassword(user, current))) return bad("Obecne hasło jest nieprawidłowe", 403);
    if (next.length < MIN_PASSWORD_LENGTH) return bad(`Nowe hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków`);
    if (next === current) return bad("Nowe hasło musi się różnić od obecnego");

    await setPassword(user.username, next);
    // Po zmianie hasła wylogowujemy pozostałe urządzenia — skradziona sesja przestaje działać
    await endOtherSessions(user.username);
    return ok();
  });
}
