import { withAuth, ok, bad } from "@/lib/api";
import { addPost, getCampaign, listCharacters } from "@/lib/adventure/data";
import { isGmBusy } from "@/lib/adventure/gm";

// Deklaracja działania postaci w bieżącej rundzie
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (session) => {
    const c = await getCampaign(id);
    if (!c) return bad("Nie ma takiej przygody", 404);
    if (c.status !== "active") return bad(c.status === "setup" ? "Przygoda jeszcze się nie zaczęła" : "Przygoda się zakończyła");
    if (await isGmBusy(id)) return bad("Mistrz Gry właśnie pisze — poczekaj chwilę");
    const me = (await listCharacters(id)).find((ch) => ch.username === session.username);
    if (!me) return bad("Najpierw stwórz postać");

    const body = await req.json().catch(() => null);
    const text = String(body?.body ?? "").trim();
    if (!text) return bad("Napisz, co robi Twoja postać");
    await addPost({ campaign_id: id, round: c.round, author: session.username, kind: "action", body: text.slice(0, 2000) });
    return ok();
  });
}
