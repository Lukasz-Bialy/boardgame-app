import { withAdmin, ok, bad } from "@/lib/api";
import { listPairs, redraw, deleteDraw } from "@/lib/data-gifts";

// Podgląd wszystkich par — wyłącznie administrator.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAdmin(async () => ok({ pairs: await listPairs(id) }));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAdmin(async () => {
    const body = await req.json().catch(() => null);
    if (body?.redraw) {
      await redraw(id);
      return ok();
    }
    return bad("Nieznana operacja");
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAdmin(async () => {
    await deleteDraw(id);
    return ok();
  });
}
