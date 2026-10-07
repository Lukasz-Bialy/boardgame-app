import { withAuth, ok, bad } from "@/lib/api";
import { q, run } from "@/lib/db";
import { getTeamRoster } from "@/lib/lolesports";

const TTL_MS = 24 * 3600_000;

// Skład drużyny LoL do podglądu w power rankingu; ?slug= z lolesports, zapamiętany na dobę
export async function GET(req: Request) {
  return withAuth(async () => {
    const slug = new URL(req.url).searchParams.get("slug") ?? "";
    if (!/^[a-z0-9-]{1,60}$/i.test(slug)) return bad("Nieprawidłowa drużyna");
    const key = `lolteam:${slug}`;
    const cached = (await q<{ data: string; updated_at: string }>(`SELECT data, updated_at FROM riot_cache WHERE key = ?`, [key]))[0];
    if (cached && Date.now() - Date.parse(cached.updated_at) < TTL_MS) return ok({ players: JSON.parse(cached.data) });
    try {
      const players = await getTeamRoster(slug);
      await run(
        `INSERT INTO riot_cache (key, data, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
        [key, JSON.stringify(players), new Date().toISOString()],
      );
      return ok({ players });
    } catch (e) {
      console.error(e);
      // Lepiej stary skład niż żaden
      if (cached) return ok({ players: JSON.parse(cached.data) });
      return bad("Nie udało się pobrać składu z lolesports", 502);
    }
  });
}
