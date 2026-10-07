import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Nav from "@/components/Nav";
import ChatWidget from "@/components/ChatWidget";
import { PLAYERS } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Czat = kanał Discorda przez WidgetBot; bez skonfigurowanych id widget się nie pokazuje
  const discordServerId = process.env.DISCORD_SERVER_ID;
  const discordChannelId = process.env.DISCORD_CHANNEL_ID;

  return (
    <div className="flex min-h-screen flex-col">
      <Nav session={session} />
      {/* pb-24: miejsce na przycisk czatu w prawym dolnym rogu, żeby nie zasłaniał końca treści */}
      <main className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pt-8">
        <div className="mx-auto w-full max-w-[1440px]">{children}</div>
      </main>
      {discordServerId && discordChannelId && (
        <ChatWidget
          serverId={discordServerId}
          channelId={discordChannelId}
          displayName={PLAYERS.find((p) => p.username === session.username)?.displayName ?? session.username}
        />
      )}
    </div>
  );
}
