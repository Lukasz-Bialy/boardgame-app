import { withAuth, ok, bad } from "@/lib/api";
import { getCampaign, listCharacters } from "@/lib/adventure/data";
import { freeRoll } from "@/lib/adventure/gm";
import { DICE } from "@/lib/adventure/rules";

// Swobodny rzut dowolną kością — widoczny dla wszystkich i dla MG
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (session) => {
    const c = await getCampaign(id);
    if (!c || c.status !== "active") return bad("Przygoda nie trwa");
    const me = (await listCharacters(id)).find((ch) => ch.username === session.username);
    if (!me) return bad("Najpierw stwórz postać");
    const body = await req.json().catch(() => null);
    const sides = Number(body?.sides);
    if (!(DICE as readonly number[]).includes(sides)) return bad("Nieznana kość");
    const roll = await freeRoll(c, me, sides, typeof body?.note === "string" ? body.note : null);
    return ok({ roll });
  });
}
