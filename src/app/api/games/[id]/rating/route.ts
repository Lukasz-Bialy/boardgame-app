import { withAuth, ok, bad } from "@/lib/api";
import { setRating } from "@/lib/data-games";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (session) => {
    const body = await req.json().catch(() => null);
    const score = Number(body?.score);
    if (!Number.isInteger(score) || score < 1 || score > 10) {
      return bad("Ocena musi być liczbą od 1 do 10");
    }
    await setRating(id, session.username, score);
    return ok();
  });
}
