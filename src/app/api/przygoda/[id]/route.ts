import { withAuth, ok, bad } from "@/lib/api";
import { deleteCampaign, getCampaign, setCampaignStatus } from "@/lib/adventure/data";

type Ctx = { params: Promise<{ id: string }> };

// Zakończenie / wznowienie kampanii — autor albo admin
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return withAuth(async (session) => {
    const c = await getCampaign(id);
    if (!c) return bad("Nie ma takiej przygody", 404);
    if (c.created_by !== session.username && session.role !== "admin") return bad("Tylko autor przygody", 403);
    const body = await req.json().catch(() => null);
    if (body?.status === "ended") await setCampaignStatus(id, "ended");
    else if (body?.status === "active" && c.status === "ended") await setCampaignStatus(id, c.round > 0 ? "active" : "setup");
    else return bad("Nieznana zmiana");
    return ok();
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return withAuth(async (session) => {
    const c = await getCampaign(id);
    if (!c) return ok();
    if (c.created_by !== session.username && session.role !== "admin") return bad("Tylko autor przygody", 403);
    await deleteCampaign(id);
    return ok();
  });
}
