import { withAuth, ok, bad } from "@/lib/api";
import { deleteCharacter, getCharacter, portraitPrompt, updateCharacter } from "@/lib/adventure/data";
import { createImage } from "@/lib/adventure/images";
import { run } from "@/lib/db";

type Ctx = { params: Promise<{ id: string; cid: string }> };

// Edycja wyglądu/historii i losowanie nowego portretu — właściciel postaci albo admin
export async function PATCH(req: Request, { params }: Ctx) {
  const { cid } = await params;
  return withAuth(async (session) => {
    const ch = await getCharacter(cid);
    if (!ch) return bad("Nie ma takiej postaci", 404);
    if (ch.username !== session.username && session.role !== "admin") return bad("To nie Twoja postać", 403);
    const body = await req.json().catch(() => ({}));

    const look = typeof body.look === "string" ? body.look.trim().slice(0, 300) || null : ch.look;
    const backstory = typeof body.backstory === "string" ? body.backstory.trim().slice(0, 1500) || null : ch.backstory;
    let portrait = ch.portrait_image_id;
    if (body.portrait === "reroll") {
      portrait = await createImage("portrait", portraitPrompt({ ...ch, look }));
      if (!portrait) return bad("Brak skonfigurowanego generatora obrazków");
      if (ch.portrait_image_id) await run(`DELETE FROM adv_images WHERE id = ?`, [ch.portrait_image_id]);
    }
    await updateCharacter(cid, { look, backstory, portrait_image_id: portrait });
    return ok({ portrait_image_id: portrait });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { cid } = await params;
  return withAuth(async (session) => {
    const ch = await getCharacter(cid);
    if (!ch) return ok();
    if (ch.username !== session.username && session.role !== "admin") return bad("To nie Twoja postać", 403);
    await deleteCharacter(cid);
    return ok();
  });
}
