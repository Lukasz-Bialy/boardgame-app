import { withAdmin, ok, bad } from "@/lib/api";
import { createTournament, syncTournament, type TournamentSource } from "@/lib/pickem";
import { getLeagues, getTournaments, tournamentTitle } from "@/lib/lolesports";

export async function POST(req: Request) {
  return withAdmin(async (session) => {
    const body = await req.json().catch(() => null);
    let name = String(body?.name ?? "").trim().slice(0, 80);
    const description = String(body?.description ?? "").trim().slice(0, 500) || null;

    // Turniej z lolesports: edycję sprawdzamy w API i bierzemy z niej zakres dat
    let source: TournamentSource | null = null;
    if (body?.source?.league_id && body?.source?.tournament_id) {
      const leagueId = String(body.source.league_id);
      const tournamentId = String(body.source.tournament_id);
      try {
        const [leagues, editions] = await Promise.all([getLeagues(), getTournaments(leagueId)]);
        const ed = editions.find((t) => t.id === tournamentId);
        if (!ed) return bad("Nie znaleziono tej edycji w lolesports");
        source = { league_id: leagueId, tournament_id: ed.id, start: ed.startDate, end: ed.endDate };
        if (!name) name = tournamentTitle(leagues.find((l) => l.id === leagueId)?.name ?? "LoL", ed.slug);
      } catch (e) {
        console.error(e);
        return bad("lolesports nie odpowiada — spróbuj później albo załóż turniej ręcznie", 502);
      }
    }
    if (!name) return bad("Podaj nazwę turnieju");

    const { id, token } = await createTournament(name, description, session.username, source);
    // Od razu pierwsze pobranie meczów; błąd nie blokuje założenia turnieju (widać go na stronie turnieju)
    if (source) await syncTournament(id, true);
    return ok({ token });
  });
}
