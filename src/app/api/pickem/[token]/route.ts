import { withAdmin, ok, bad } from "@/lib/api";
import { getTournamentId, updateTournament, deleteTournament } from "@/lib/pickem";

type Ctx = { params: Promise<{ token: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { token } = await params;
  return withAdmin(async () => {
    const id = await getTournamentId(token);
    if (!id) return bad("Nie znaleziono turnieju", 404);
    const body = await req.json().catch(() => null);
    const name = String(body?.name ?? "").trim().slice(0, 80);
    if (!name) return bad("Podaj nazwę turnieju");
    await updateTournament(id, name, String(body?.description ?? "").trim().slice(0, 500) || null);
    return ok();
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { token } = await params;
  return withAdmin(async () => {
    const id = await getTournamentId(token);
    if (!id) return bad("Nie znaleziono turnieju", 404);
    await deleteTournament(id);
    return ok();
  });
}
