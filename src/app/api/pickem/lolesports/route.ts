import { withAdmin, ok, bad } from "@/lib/api";
import { getLeagues, getTournaments } from "@/lib/lolesports";

// Bez parametru: lista lig; z ?leagueId=: edycje tej ligi (od najnowszej)
export async function GET(req: Request) {
  return withAdmin(async () => {
    const leagueId = new URL(req.url).searchParams.get("leagueId");
    try {
      return ok(leagueId ? { tournaments: await getTournaments(leagueId) } : { leagues: await getLeagues() });
    } catch (e) {
      console.error(e);
      return bad("lolesports nie odpowiada — spróbuj później albo załóż turniej ręcznie", 502);
    }
  });
}
