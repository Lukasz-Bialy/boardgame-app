import { withAuth, ok, bad } from "@/lib/api";
import { updateOrder, updateOrderPaidBy, settleUser, unsettleUser, deleteOrder } from "@/lib/data-kebab";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    const body = await req.json().catch(() => null);
    if (!body?.restaurant_id) return bad("Wybierz restaurację");
    if (!body?.date) return bad("Podaj datę zamówienia");
    if (!Array.isArray(body?.items) || body.items.length === 0)
      return bad("Dodaj co najmniej jedną pozycję");

    const items = (body.items as { id?: string; username: string; item_name: string; price: number }[])
      .filter((i) => i.username && i.item_name?.trim() && i.price > 0)
      .map((i) => ({ id: i.id || undefined, username: i.username, item_name: i.item_name.trim(), price: Math.round(i.price) }));
    if (!items.length) return bad("Wszystkie pozycje muszą mieć użytkownika, nazwę i cenę > 0");

    await updateOrder(id, {
      restaurant_id: body.restaurant_id,
      date: body.date,
      note: body.note?.trim() || null,
      meeting_id: body.meeting_id || null,
      delivery_cost: Math.round(Number(body.delivery_cost) || 0),
      paid_by: body.paid_by || null,
      items,
    });
    return ok();
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    const body = await req.json().catch(() => null);
    if (!body) return bad("Brak danych");

    if ("paid_by" in body) {
      await updateOrderPaidBy(id, body.paid_by || null);
      return ok();
    }
    if (body.settle) {
      await settleUser(id, body.settle);
      return ok();
    }
    if (body.unsettle) {
      await unsettleUser(id, body.unsettle);
      return ok();
    }
    return bad("Nieznana operacja");
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    await deleteOrder(id);
    return ok();
  });
}
