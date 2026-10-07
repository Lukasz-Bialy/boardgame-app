import { withAuth, ok, bad } from "@/lib/api";
import { getTournamentId, setPick } from "@/lib/pickem";

const optNum = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

export async function PUT(req: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  return withAuth(async (session) => {
    const tid = await getTournamentId(token);
    if (!tid) return bad("Nie znaleziono turnieju", 404);
    const body = await req.json().catch(() => null);
    const err = await setPick(
      tid,
      id,
      session.username,
      body?.team_id ? String(body.team_id) : null,
      optNum(body?.loser_wins),
      optNum(body?.stake), // brak = stawka bez zmian (np. typ z pulpitu)
    );
    return err ? bad(err) : ok();
  });
}
