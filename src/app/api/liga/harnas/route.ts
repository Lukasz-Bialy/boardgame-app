import { withAuth, ok, bad } from "@/lib/api";
import { EARLIEST_DAY, RiotError, syncClubGames, warsawDay, warsawDayStart } from "@/lib/riot";
import { queryHarnasGames } from "@/lib/liga-queries";

const MONTH_RE = /^(\d{4})-(\d{2})$/;

/**
 * GET /api/liga/harnas?miesiac=YYYY-MM — mecze miesiąca z wynikami Harnasia.
 * Starsze mecze z cache nie mają potrzebnych statystyk — dociągamy je od nowa (limit Riot API),
 * więc przy dużym miesiącu odpowiedź ma missing > 0 i klient ponawia, aż wszystko się przeliczy.
 */
export async function GET(req: Request) {
  return withAuth(async () => {
    const month = new URL(req.url).searchParams.get("miesiac") ?? "";
    const m = MONTH_RE.exec(month);
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return bad("Nieprawidłowy miesiąc");
    if (month > warsawDay(Date.now()).slice(0, 7) || month < EARLIEST_DAY.slice(0, 7)) {
      return bad("Brak danych dla tego miesiąca");
    }

    const [y, mo] = [Number(m[1]), Number(m[2])];
    const next = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
    try {
      const [start, end] = [warsawDayStart(`${month}-01`), warsawDayStart(next)];
      const sync = await syncClubGames(start, end, { upgrade: true });
      return ok({ month, missing: sync.missing, incomplete: sync.incomplete, games: await queryHarnasGames(start, end) });
    } catch (e) {
      if (e instanceof RiotError) return bad(e.message, 502);
      throw e;
    }
  });
}
