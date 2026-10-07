import { withAuth, ok, bad } from "@/lib/api";
import { addPost, createCharacter, getCampaign, listCharacters, validateCharacter, type CharacterInput } from "@/lib/adventure/data";
import { classById, raceById } from "@/lib/adventure/rules";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (session) => {
    const c = await getCampaign(id);
    if (!c) return bad("Nie ma takiej przygody", 404);
    if (c.status === "ended") return bad("Ta przygoda już się zakończyła");
    const chars = await listCharacters(id);
    if (chars.some((ch) => ch.username === session.username)) return bad("Masz już postać w tej przygodzie");

    const body = (await req.json().catch(() => null)) as CharacterInput | null;
    if (!body) return bad("Brak danych postaci");
    const err = validateCharacter(body);
    if (err) return bad(err);

    const cid = await createCharacter(id, session.username, body);
    if (c.status === "active") {
      await addPost({
        campaign_id: id,
        round: c.round,
        author: "system",
        kind: "system",
        body: `${body.name.trim()} (${raceById(body.race_id)!.name}, ${classById(body.class_id)!.name}) dołącza do drużyny. Mistrz Gry wprowadzi postać w następnej turze.`,
      });
    }
    return ok({ id: cid });
  });
}
