import { withAuth, ok, bad } from "@/lib/api";
import { getPollByToken, setPollOpen, deletePoll } from "@/lib/data-misc";

export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return withAuth(async (session) => {
    const poll = await getPollByToken(token, session.username);
    if (!poll) return bad("Nie znaleziono ankiety", 404);
    if (session.role !== "admin" && poll.created_by !== session.username) {
      return bad("Tylko autor ankiety lub admin może ją zamknąć", 403);
    }
    const body = await req.json().catch(() => null);
    await setPollOpen(token, Boolean(body?.is_open));
    return ok();
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return withAuth(async (session) => {
    const poll = await getPollByToken(token, session.username);
    if (!poll) return bad("Nie znaleziono ankiety", 404);
    if (session.role !== "admin" && poll.created_by !== session.username) {
      return bad("Tylko autor ankiety lub admin może ją usunąć", 403);
    }
    await deletePoll(token);
    return ok();
  });
}
