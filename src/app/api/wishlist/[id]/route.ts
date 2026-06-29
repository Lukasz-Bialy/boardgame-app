import { withAuth, ok } from "@/lib/api";
import { deleteWishlist } from "@/lib/data-misc";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    await deleteWishlist(id);
    return ok();
  });
}
