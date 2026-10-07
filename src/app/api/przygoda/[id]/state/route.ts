import { withAuth, ok, bad } from "@/lib/api";
import { getCampaign, lastPostId } from "@/lib/adventure/data";
import { isGmBusy } from "@/lib/adventure/gm";

// Lekki odczyt do odpytywania: klient odświeża stronę, gdy pojawi się nowy post albo zmieni się stan MG
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    const c = await getCampaign(id);
    if (!c) return bad("Nie ma takiej przygody", 404);
    const [last, busy] = await Promise.all([lastPostId(id), isGmBusy(id)]);
    return ok({ lastPostId: last, busy, error: c.gm_error, round: c.round, status: c.status });
  });
}
