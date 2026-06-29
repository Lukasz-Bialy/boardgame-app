import { withAdmin, ok, bad } from "@/lib/api";
import { createGame, type GameInput } from "@/lib/data-games";

function parseGame(body: any): GameInput | null {
  if (!body || typeof body.name !== "string" || !body.name.trim()) return null;
  const num = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v));
  return {
    name: body.name.trim(),
    image_url: body.image_url?.trim() || null,
    min_players: num(body.min_players),
    max_players: num(body.max_players),
    play_time: num(body.play_time),
    description: body.description?.trim() || null,
  };
}

export async function POST(req: Request) {
  return withAdmin(async () => {
    const data = parseGame(await req.json().catch(() => null));
    if (!data) return bad("Podaj nazwę gry");
    const id = await createGame(data);
    return ok({ id });
  });
}
