import { getSession } from "@/lib/auth";
import { PLAYERS } from "@/lib/users";
import DrawClient from "@/components/DrawClient";

export const dynamic = "force-dynamic";

export default async function DrawPage() {
  await getSession();
  const players = PLAYERS.map((p) => ({ username: p.username, displayName: p.displayName }));
  return <DrawClient players={players} />;
}
