import { withAuth, ok, bad } from "@/lib/api";
import { deleteMessage, getMessage } from "@/lib/data-chat";

// Usunąć można własną wiadomość; administrator — każdą.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (session) => {
    const msg = await getMessage(Number(id));
    if (!msg) return bad("Nie ma takiej wiadomości", 404);
    if (msg.username !== session.username && session.role !== "admin") {
      return bad("Możesz usuwać tylko swoje wiadomości", 403);
    }
    await deleteMessage(msg.id);
    return ok();
  });
}
