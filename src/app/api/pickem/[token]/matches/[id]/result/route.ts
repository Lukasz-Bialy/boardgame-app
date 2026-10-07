import { withAdmin, ok, bad } from "@/lib/api";
import { getTournamentId, setResult } from "@/lib/pickem";

type Ctx = { params: Promise<{ token: string; id: string }> };

const score = (v: unknown) => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isInteger(n) || n < 0 || n > 9 ? null : n;
};

export async function PUT(req: Request, { params }: Ctx) {
  const { token, id } = await params;
  return withAdmin(async () => {
    const tid = await getTournamentId(token);
    if (!tid) return bad("Nie znaleziono turnieju", 404);
    const body = await req.json().catch(() => null);
    const winner = String(body?.winner_id ?? "");
    if (!winner) return bad("Wybierz zwycięzcę");
    const err = await setResult(tid, id, { winner_id: winner, score_a: score(body?.score_a), score_b: score(body?.score_b) });
    return err ? bad(err) : ok();
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { token, id } = await params;
  return withAdmin(async () => {
    const tid = await getTournamentId(token);
    if (!tid) return bad("Nie znaleziono turnieju", 404);
    const err = await setResult(tid, id, null);
    return err ? bad(err) : ok();
  });
}
