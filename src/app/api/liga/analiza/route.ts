import { withAuth, ok, bad } from "@/lib/api";
import { getAccount, LEAGUE_PLAYERS, RiotError, syncCacheWithKey } from "@/lib/riot";
import { getMatchDetails } from "@/lib/riot-details";
import { analyzeMatches } from "@/lib/match-analysis";

// 2 zapytania na mecz, a limit klucza to 100 na 2 min — więcej naraz i tak by się nie pobrało
// (ta sama wartość w LigaDeepAnalysis.tsx)
const MAX_ANALYSIS_GAMES = 30;
const ID_RE = /^[A-Z0-9]+_\d+$/;

/**
 * POST /api/liga/analiza  { ids: string[], gracze: string[] }
 * Szczegóły i oś czasu meczów (z cache albo Riot API) → co idzie najgorzej indywidualnie i drużynowo.
 * Gdy Riot odmówi (limit zapytań), zwracamy analizę tego, co jest, i listę brakujących meczów — klient ponawia.
 */
export async function POST(req: Request) {
  return withAuth(async () => {
    const body = await req.json().catch(() => null);
    const ids: string[] = Array.isArray(body?.ids) ? [...new Set<string>(body.ids.map(String))] : [];
    if (!ids.length) return bad("Wybierz mecze do analizy");
    if (ids.length > MAX_ANALYSIS_GAMES) return bad(`Naraz można przeanalizować najwyżej ${MAX_ANALYSIS_GAMES} meczów`);
    if (!ids.every((id) => ID_RE.test(id))) return bad("Nieprawidłowy identyfikator meczu");
    const usernames = LEAGUE_PLAYERS.map((p) => p.username);
    const lineup: string[] = Array.isArray(body?.gracze) ? body.gracze.filter((u: unknown) => usernames.includes(String(u))) : [];
    if (!lineup.length) return bad("Wybierz graczy do analizy");

    try {
      await syncCacheWithKey();
      const club = new Map<string, string>();
      for (const lp of LEAGUE_PLAYERS) {
        try {
          club.set((await getAccount(lp.gameName, lp.tagLine)).puuid, lp.username);
        } catch (e) {
          if (!(e instanceof RiotError && e.status === 404)) throw e;
        }
      }
      const { matches, missing } = await getMatchDetails(ids);
      return ok({ result: analyzeMatches(matches, club, lineup), missing, analyzed: matches.map((m) => m.id) });
    } catch (e) {
      if (e instanceof RiotError) return bad(e.message, 502);
      throw e;
    }
  });
}
