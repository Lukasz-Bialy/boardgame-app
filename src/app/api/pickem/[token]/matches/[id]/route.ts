import { withAdmin, ok, bad } from "@/lib/api";
import { deleteMatch, getTournamentId, parseMatchInput, updateMatch } from "@/lib/pickem";

type Ctx = { params: Promise<{ token: string; id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { token, id } = await params;
  return withAdmin(async () => {
    const tid = await getTournamentId(token);
    if (!tid) return bad("Nie znaleziono turnieju", 404);
    const input = parseMatchInput(await req.json().catch(() => null));
    if (typeof input === "string") return bad(input);
    const err = await updateMatch(tid, id, input);
    return err ? bad(err) : ok();
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { token, id } = await params;
  return withAdmin(async () => {
    const tid = await getTournamentId(token);
    if (!tid) return bad("Nie znaleziono turnieju", 404);
    if (!(await deleteMatch(tid, id))) return bad("Nie znaleziono meczu", 404);
    return ok();
  });
}
