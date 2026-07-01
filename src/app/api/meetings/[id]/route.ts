import { withAuth, ok, bad } from "@/lib/api";
import { deleteMeeting, linkMeetingPoll } from "@/lib/data-misc";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    await deleteMeeting(id);
    return ok();
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    const body = await req.json().catch(() => null);
    if (!body || !("poll_token" in body)) return bad("Brak pola poll_token");
    const pollToken: string | null = body.poll_token?.trim() || null;
    await linkMeetingPoll(id, pollToken);
    return ok();
  });
}
