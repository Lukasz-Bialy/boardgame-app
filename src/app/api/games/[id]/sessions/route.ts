import { withAuth, ok, bad } from "@/lib/api";
import { createSession, type SessionInput } from "@/lib/data-games";
import { findUserByLogin } from "@/lib/users";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (session) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.played_at !== "string" || !body.played_at) {
      return bad("Podaj datę rozgrywki");
    }
    const rawPlacements = Array.isArray(body.placements) ? body.placements : [];
    const placements = rawPlacements
      .filter((p: any) => p && p.player && findUserByLogin(p.player) && Number(p.place) > 0)
      .map((p: any) => ({ player: String(p.player), place: Number(p.place) }));

    if (placements.length === 0) return bad("Dodaj przynajmniej jednego gracza z miejscem");

    const input: SessionInput = {
      played_at: body.played_at,
      duration_min: body.duration_min ? Number(body.duration_min) : null,
      note: body.note?.trim() || null,
      placements,
    };
    const sid = await createSession(id, input, session.username);
    return ok({ id: sid });
  });
}
