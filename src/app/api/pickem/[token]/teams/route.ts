import { withAdmin, ok, bad } from "@/lib/api";
import { addTeams, getTournamentId, parseTeamInput, type TeamInput } from "@/lib/pickem";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return withAdmin(async () => {
    const id = await getTournamentId(token);
    if (!id) return bad("Nie znaleziono turnieju", 404);
    const body = await req.json().catch(() => null);
    const teams = (Array.isArray(body?.teams) ? body.teams : []).map(parseTeamInput).filter(Boolean) as TeamInput[];
    if (!teams.length) return bad("Podaj przynajmniej jedną drużynę");
    if (teams.length > 64) return bad("Za dużo drużyn naraz");
    await addTeams(id, teams);
    return ok();
  });
}
