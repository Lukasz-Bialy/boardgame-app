import { getSession } from "@/lib/auth";
import { listDrawsForUser } from "@/lib/data-gifts";
import { PLAYERS } from "@/lib/users";
import GiftsClient from "@/components/GiftsClient";

export const dynamic = "force-dynamic";

export default async function PrezentyPage() {
  const session = (await getSession())!;
  // Do klienta trafia tylko wynik zalogowanej osoby — pełne pary admin pobiera osobno z API.
  const draws = await listDrawsForUser(session.username);
  const players = PLAYERS.map((p) => ({ username: p.username, displayName: p.displayName }));

  return (
    <GiftsClient
      draws={draws}
      players={players}
      isAdmin={session.role === "admin"}
    />
  );
}
