import { withAuth, ok, bad } from "@/lib/api";
import {
  addMessage,
  listAfter,
  listBefore,
  listOnline,
  listRecent,
  recentIds,
  touchPresence,
  MAX_MESSAGE_LENGTH,
} from "@/lib/data-chat";

/**
 * GET /api/chat             — ostatnie wiadomości + kto jest aktywny (i sygnał obecności)
 * GET /api/chat?after=<id>  — tylko nowsze wiadomości (odpytywanie)
 * GET /api/chat?before=<id> — starsza historia (bez sygnału obecności)
 */
export async function GET(req: Request) {
  return withAuth(async (session) => {
    const params = new URL(req.url).searchParams;
    const before = Number(params.get("before"));
    if (before > 0) return ok({ messages: await listBefore(before) });

    await touchPresence(session.username);
    const after = Number(params.get("after"));
    const [messages, online, ids] = await Promise.all([
      after > 0 ? listAfter(after) : listRecent(),
      listOnline(),
      recentIds(),
    ]);
    return ok({ messages, online, recentIds: ids });
  });
}

export async function POST(req: Request) {
  return withAuth(async (session) => {
    const body = await req.json().catch(() => null);
    const text = String(body?.body ?? "").trim();
    if (!text) return bad("Wiadomość jest pusta");
    if (text.length > MAX_MESSAGE_LENGTH) return bad(`Wiadomość może mieć maksymalnie ${MAX_MESSAGE_LENGTH} znaków`);
    return ok({ message: await addMessage(session.username, text) });
  });
}
