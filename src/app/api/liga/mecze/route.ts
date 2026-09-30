import { withAuth, ok } from "@/lib/api";
import { filterFromSearch } from "@/lib/liga-params";
import { queryGamesPage, queryPlayerCards } from "@/lib/liga-queries";

const MAX_LIMIT = 100;

/**
 * GET /api/liga/mecze?od&do&gracze&premade&tryb&offset=0&limit=30
 * Strona listy meczów z bazy; przy offset=0 także karty graczy (agregaty SQL). limit=0 — same karty.
 */
export async function GET(req: Request) {
  return withAuth(async () => {
    const sp = new URL(req.url).searchParams;
    const filter = filterFromSearch(sp);
    const offset = Math.max(0, Number(sp.get("offset")) || 0);
    const limit = Math.min(MAX_LIMIT, Math.max(0, Number(sp.get("limit") ?? 30) || 0));
    const [page, cards] = await Promise.all([
      queryGamesPage(filter, offset, limit),
      offset === 0 ? queryPlayerCards(filter) : null,
    ]);
    return ok({ ...page, cards });
  });
}
