import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Nav from "@/components/Nav";
import ChatWidget from "@/components/ChatWidget";
import { PLAYERS } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <Nav session={session} />
      {/* pb-24: miejsce na przycisk czatu w prawym dolnym rogu, żeby nie zasłaniał końca treści */}
      <main className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pt-24">
        <div className="mx-auto w-full max-w-[1440px]">{children}</div>
      </main>
      <ChatWidget
        currentUser={session.username}
        isAdmin={session.role === "admin"}
        players={PLAYERS.map((p) => ({ username: p.username, displayName: p.displayName }))}
      />
    </div>
  );
}
