import { withAuth, ok, bad } from "@/lib/api";
import { updateOrderPaidBy, settleUser, unsettleUser, deleteOrder } from "@/lib/data-kebab";

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
