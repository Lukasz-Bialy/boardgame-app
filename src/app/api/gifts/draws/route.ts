import { withAdmin, ok, bad } from "@/lib/api";
import { createDraw } from "@/lib/data-gifts";
import { USERS } from "@/lib/users";

export async function POST(req: Request) {
  return withAdmin(async (session) => {
    const body = await req.json().catch(() => null);
    const title = String(body?.title ?? "").trim();
    if (!title) return bad("Podaj nazwę losowania");

    const known = new Set(USERS.map((u) => u.username));
    const participants = [...new Set((Array.isArray(body?.participants) ? body.participants : []) as string[])]
      .filter((u) => known.has(u));
    if (participants.length < 3) return bad("Potrzeba co najmniej 3 uczestników");

    const budget = Math.round(Number(body?.budget) || 0);
    const id = await createDraw(
      {
        title,
        budget: budget > 0 ? budget : null,
        note: String(body?.note ?? "").trim() || null,
        participants,
      },
      session.username
    );
    return ok({ id });
  });
}
