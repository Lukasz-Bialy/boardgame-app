import { withAuth, ok, bad } from "@/lib/api";
import { setVotes } from "@/lib/data-misc";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return withAuth(async (session) => {
    const body = await req.json().catch(() => null);
    const optionIds = Array.isArray(body?.optionIds) ? body.optionIds.map(String) : [];
    const okVote = await setVotes(token, optionIds, session.username);
    if (!okVote) return bad("Ankieta jest zamknięta lub nie istnieje", 400);
    return ok();
  });
}
