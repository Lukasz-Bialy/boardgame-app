import { withAuth, ok } from "@/lib/api";
import { deleteRestaurant } from "@/lib/data-kebab";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    await deleteRestaurant(id);
    return ok();
  });
}
