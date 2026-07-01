import { withAuth, ok, bad } from "@/lib/api";
import { createMeeting } from "@/lib/data-misc";

export async function POST(req: Request) {
  return withAuth(async (session) => {
    const body = await req.json().catch(() => null);
    const date = String(body?.date ?? "");
    const title = String(body?.title ?? "").trim();
    if (!date) return bad("Podaj datę spotkania");
    if (!title) return bad("Podaj nazwę spotkania");
    const pollToken = body?.poll_token?.trim() || null;
    const id = await createMeeting(
      { date, title, note: body?.note?.trim() || null, poll_token: pollToken },
      session.username
    );
    return ok({ id });
  });
}
