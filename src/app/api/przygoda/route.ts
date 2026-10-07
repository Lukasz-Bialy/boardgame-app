import { withAuth, ok, bad } from "@/lib/api";
import { createCampaign } from "@/lib/adventure/data";
import { TONES } from "@/lib/adventure/rules";

export async function POST(req: Request) {
  return withAuth(async (session) => {
    const body = await req.json().catch(() => null);
    const title = String(body?.title ?? "").trim();
    if (!title) return bad("Podaj tytuł przygody");
    const tone = TONES.some((t) => t.id === body?.tone) ? body.tone : TONES[0].id;
    const id = await createCampaign(
      { title: title.slice(0, 80), premise: String(body?.premise ?? "").trim().slice(0, 1500) || null, tone },
      session.username
    );
    return ok({ id });
  });
}
