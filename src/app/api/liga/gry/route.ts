import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { parseRange, rangeMs } from "@/lib/liga-params";
import { streamGamesJson } from "@/lib/liga-queries";

/**
 * GET /api/liga/gry?od&do — wszystkie mecze z zakresu (LeagueGame[]) dla wykresów i analityki,
 * które liczą w przeglądarce. Pobierane dopiero po otwarciu tych zakładek; strumieniowane porcjami z bazy.
 */
export async function GET(req: Request) {
  return withAuth(async () => {
    const sp = new URL(req.url).searchParams;
    const { from, to } = parseRange(sp.get("od"), sp.get("do"));
    const { start, end } = rangeMs(from, to);
    return new NextResponse(streamGamesJson(start, end), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  });
}
