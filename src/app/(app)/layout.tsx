import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Nav from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <Nav session={session} />
      <main className="flex-1 px-4 py-6 md:px-8 md:pb-10 md:pt-24">        <div className="mx-auto w-full max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}
