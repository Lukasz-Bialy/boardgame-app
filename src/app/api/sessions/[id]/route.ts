import { withAuth, ok, bad } from "@/lib/api";
import { getSession as getPlaySession, deleteSession } from "@/lib/data-games";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (session) => {
    const play = await getPlaySession(id);
    if (!play) return bad("Nie znaleziono rozgrywki", 404);
    if (session.role !== "admin" && play.created_by !== session.username) {
      return bad("Możesz usunąć tylko rozgrywkę, którą dodałeś", 403);
    }
    await deleteSession(id);
    return ok();
  });
}
