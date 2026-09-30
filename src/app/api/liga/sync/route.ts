import { withAuth, ok, bad } from "@/lib/api";
import { RiotError, syncClubGames } from "@/lib/riot";
import { parseRange, rangeMs } from "@/lib/liga-params";

// Przy krótkim zakresie dociągamy też statystyki Harnasia dla meczów ze starego zapisu —
// przy dłuższym kosztowałoby to setki zapytań; tam robi to przeliczenie miesiąca w rankingu
const UPGRADE_MAX_DAYS = 31;

/**
 * POST /api/liga/sync?od=YYYY-MM-DD&do=YYYY-MM-DD
 * Dociąga z Riot API nowe mecze z zakresu i zapisuje je przeliczone (najwyżej ~90 na wywołanie — limit klucza).
 * Nie zwraca meczów: added > 0 → klient odświeża widok; missing > 0 / incomplete → ponawia za chwilę.
 */
export async function POST(req: Request) {
  return withAuth(async () => {
    const sp = new URL(req.url).searchParams;
    const { from, to } = parseRange(sp.get("od"), sp.get("do"));
    const { start, end } = rangeMs(from, to);
    const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
    try {
      return ok(await syncClubGames(start, end, { upgrade: days <= UPGRADE_MAX_DAYS }));
    } catch (e) {
      if (e instanceof RiotError) return bad(e.message, 502);
      throw e;
    }
  });
}
