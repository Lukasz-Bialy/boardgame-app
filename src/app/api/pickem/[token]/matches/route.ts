import { withAdmin, ok, bad } from "@/lib/api";
import { createMatch, getTournamentId, parseMatchInput } from "@/lib/pickem";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return withAdmin(async () => {
    const tid = await getTournamentId(token);
    if (!tid) return bad("Nie znaleziono turnieju", 404);
    const input = parseMatchInput(await req.json().catch(() => null));
    if (typeof input === "string") return bad(input);
    const err = await createMatch(tid, input);
    return err ? bad(err) : ok();
  });
}
