import { getSession } from "@/lib/auth";
import { listOrders, listRestaurants } from "@/lib/data-kebab";
import { listMeetings } from "@/lib/data-misc";
import { PLAYERS } from "@/lib/users";
import KebabClient from "@/components/KebabClient";

export const dynamic = "force-dynamic";

export default async function KebabPage() {
  const session = (await getSession())!;
  const [orders, restaurants, meetings] = await Promise.all([
    listOrders(),
    listRestaurants(),
    listMeetings(),
  ]);

  const players = PLAYERS.map((p) => ({ username: p.username, displayName: p.displayName }));
  const meetingsLite = meetings.map((m) => ({ id: m.id, date: m.date, title: m.title }));

  return (
    <KebabClient
      orders={orders}
      restaurants={restaurants}
      players={players}
      meetings={meetingsLite}
      currentUser={session.username}
    />
  );
}
