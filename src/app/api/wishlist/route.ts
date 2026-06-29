import { withAuth, ok, bad } from "@/lib/api";
import { addWishlist } from "@/lib/data-misc";

export async function POST(req: Request) {
  return withAuth(async (session) => {
    const body = await req.json().catch(() => null);
    const name = String(body?.name ?? "").trim();
    if (!name) return bad("Podaj nazwę gry");
    const id = await addWishlist(
      {
        name,
        url: body?.url?.trim() || null,
        image_url: body?.image_url?.trim() || null,
        note: body?.note?.trim() || null,
      },
      session.username
    );
    return ok({ id });
  });
}
