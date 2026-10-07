import { withAdmin, ok, bad } from "@/lib/api";
import { getTournamentId, syncTournament } from "@/lib/pickem";

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return withAdmin(async () => {
    const id = await getTournamentId(token);
    if (!id) return bad("Nie znaleziono turnieju", 404);
    const res = await syncTournament(id, true);
    return typeof res === "string" ? bad(res, 502) : ok(res);
  });
}
