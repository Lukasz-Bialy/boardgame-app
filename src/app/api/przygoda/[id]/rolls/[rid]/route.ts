import { withAuth, ok, bad } from "@/lib/api";
import { getCharacter, getRoll } from "@/lib/adventure/data";
import { resolveRoll } from "@/lib/adventure/gm";

// Gracz rzuca test zlecony przez MG. Wynik losuje serwer, przeglądarka go tylko animuje.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; rid: string }> }) {
  const { rid } = await params;
  return withAuth(async (session) => {
    const roll = await getRoll(rid);
    if (!roll) return bad("Nie ma takiego rzutu", 404);
    const ch = await getCharacter(roll.character_id);
    if (!ch || ch.username !== session.username) return bad("To nie Twój rzut", 403);
    if (roll.result !== null) return bad("Ten rzut już się odbył");
    const data = await resolveRoll(roll, ch, false);
    if (!data) return bad("Ten rzut już się odbył");
    return ok({ roll: data });
  });
}
