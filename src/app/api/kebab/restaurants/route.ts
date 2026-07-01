import { withAuth, ok, bad } from "@/lib/api";
import { createRestaurant } from "@/lib/data-kebab";

export async function POST(req: Request) {
  return withAuth(async (session) => {
    const body = await req.json().catch(() => null);
    const name = String(body?.name ?? "").trim();
    if (!name) return bad("Podaj nazwę restauracji");
    const id = await createRestaurant(
      { name, address: body?.address?.trim() || null, url: body?.url?.trim() || null },
      session.username
    );
    return ok({ id });
  });
}
