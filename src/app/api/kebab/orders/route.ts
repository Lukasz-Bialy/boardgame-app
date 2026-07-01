import { withAuth, ok, bad } from "@/lib/api";
import { createOrder } from "@/lib/data-kebab";

export async function POST(req: Request) {
  return withAuth(async (session) => {
    const body = await req.json().catch(() => null);
    if (!body?.restaurant_id) return bad("Wybierz restaurację");
    if (!body?.date) return bad("Podaj datę zamówienia");
    if (!Array.isArray(body?.items) || body.items.length === 0)
      return bad("Dodaj co najmniej jedną pozycję");

    const items = (body.items as { username: string; item_name: string; price: number }[]).filter(
      (i) => i.username && i.item_name?.trim() && i.price > 0
    );
    if (!items.length) return bad("Wszystkie pozycje muszą mieć użytkownika, nazwę i cenę > 0");

    const id = await createOrder(
      {
        restaurant_id: body.restaurant_id,
        date: body.date,
        note: body.note?.trim() || null,
        meeting_id: body.meeting_id || null,
        delivery_cost: Math.round(Number(body.delivery_cost) || 0),
        paid_by: body.paid_by || null,
        items,
      },
      session.username
    );
    return ok({ id });
  });
}
