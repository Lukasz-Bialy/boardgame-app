import { withAuth, ok, bad } from "@/lib/api";
import { getCampaign, listCharacters, listPosts, listRolls, roundProgress } from "@/lib/adventure/data";
import { runGmTurn } from "@/lib/adventure/gm";

// Odpowiedź Gemini potrafi zająć kilkanaście sekund
export const maxDuration = 60;

// Tura Mistrza Gry.
//  - bez force: tylko gdy wszyscy zagrali albo minął termin rundy (wywołuje to klient automatycznie)
//  - force: „Popchnij fabułę” — gdy ktoś już coś zadeklarował (albo admin), a także start przygody
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (session) => {
    const c = await getCampaign(id);
    if (!c) return bad("Nie ma takiej przygody", 404);
    if (c.status === "ended") return bad("Przygoda się zakończyła");
    const chars = await listCharacters(id);
    if (!chars.length) return bad("Stwórzcie najpierw postacie");

    const body = await req.json().catch(() => ({}));
    if (c.status === "active") {
      const [posts, rolls] = await Promise.all([listPosts(id, 80), listRolls(id, c.round)]);
      const p = roundProgress(c, chars, posts, rolls);
      const ready = p.allDone || (p.deadlinePassed && p.contributions > 0);
      const canForce = p.contributions > 0 || p.deadlinePassed || session.role === "admin";
      if (!ready && !(body?.force && canForce)) {
        return bad(body?.force ? "Najpierw ktoś musi zadeklarować działanie" : "Runda jeszcze trwa", 409);
      }
    } else if (!chars.some((ch) => ch.username === session.username) && session.role !== "admin") {
      return bad("Rozpocząć może członek drużyny");
    }

    const res = await runGmTurn(id);
    if (!res.ok) return res.busy ? ok({ busy: true }) : bad(res.error ?? "Błąd MG", 502);
    return ok();
  });
}
