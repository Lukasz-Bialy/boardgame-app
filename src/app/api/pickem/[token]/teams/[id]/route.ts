import { withAdmin, ok, bad } from "@/lib/api";
import { deleteTeam, getTournamentId, parseTeamInput, updateTeam } from "@/lib/pickem";

type Ctx = { params: Promise<{ token: string; id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { token, id } = await params;
  return withAdmin(async () => {
    const tid = await getTournamentId(token);
    if (!tid) return bad("Nie znaleziono turnieju", 404);
    const team = parseTeamInput(await req.json().catch(() => null));
    if (!team) return bad("Podaj nazwę drużyny");
    if (!(await updateTeam(tid, id, team))) return bad("Nie znaleziono drużyny", 404);
    return ok();
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { token, id } = await params;
  return withAdmin(async () => {
    const tid = await getTournamentId(token);
    if (!tid) return bad("Nie znaleziono turnieju", 404);
    if (!(await deleteTeam(tid, id))) return bad("Nie znaleziono drużyny", 404);
    return ok();
  });
}
