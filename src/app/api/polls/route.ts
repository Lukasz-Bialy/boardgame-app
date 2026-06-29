import { withAuth, ok, bad } from "@/lib/api";
import { createPoll, type PollInput } from "@/lib/data-misc";

export async function POST(req: Request) {
  return withAuth(async (session) => {
    const body = await req.json().catch(() => null);
    const title = String(body?.title ?? "").trim();
    const type = body?.type === "date" ? "date" : "game";
    if (!title) return bad("Podaj tytuł ankiety");

    const rawOptions = Array.isArray(body?.options) ? body.options : [];
    const options = rawOptions
      .map((o: any) => ({
        label: String(o?.label ?? "").trim(),
        game_id: o?.game_id ? String(o.game_id) : null,
        date_value: o?.date_value ? String(o.date_value) : null,
      }))
      .filter((o: any) => o.label.length > 0);

    if (options.length < 2) return bad("Dodaj przynajmniej 2 opcje do głosowania");

    const input: PollInput = {
      title,
      type,
      month: body?.month ? String(body.month) : null,
      options,
    };
    const token = await createPoll(input, session.username);
    return ok({ token });
  });
}
