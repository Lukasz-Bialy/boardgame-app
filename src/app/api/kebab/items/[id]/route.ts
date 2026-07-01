import { withAuth, ok, bad } from "@/lib/api";
import { rateItem, deleteItem } from "@/lib/data-kebab";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    const body = await req.json().catch(() => null);
    if (!body) return bad("Brak danych");
    const rating = body.rating != null ? Number(body.rating) : null;
    if (rating !== null && (rating < 1 || rating > 5)) return bad("Ocena musi być 1–5");
    await rateItem(id, { rating, comment: body.comment ?? null });
    return ok();
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    await deleteItem(id);
    return ok();
  });
}
