import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft, Dices, CalendarDays } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getPollByToken } from "@/lib/data-misc";
import { displayNameOf } from "@/lib/users";
import { formatDate } from "@/components/ui";
import PollVoting from "@/components/PollVoting";

export const dynamic = "force-dynamic";

export default async function PollPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = (await getSession())!;
  const poll = await getPollByToken(token, session.username);
  if (!poll) notFound();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const shareUrl = `${proto}://${host}/polls/${poll.token}`;

  const canManage = session.role === "admin" || poll.created_by === session.username;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/polls"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-felt"
      >
        <ArrowLeft size={15} /> Ankiety
      </Link>

      <div>
        <span className={`chip ${poll.type === "date" ? "text-gold" : "text-felt"}`}>
          {poll.type === "date" ? (
            <>
              <CalendarDays size={13} /> Termin spotkania
            </>
          ) : (
            <>
              <Dices size={13} /> W co zagrać
            </>
          )}
        </span>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">{poll.title}</h1>
        <p className="mt-1 text-sm text-muted">
          Utworzył(a) {displayNameOf(poll.created_by)} · {formatDate(poll.created_at)} ·{" "}
          {poll.totalVoters} {poll.totalVoters === 1 ? "głosujący" : "głosujących"}
        </p>
      </div>

      <PollVoting poll={poll} shareUrl={shareUrl} canManage={canManage} />
    </div>
  );
}
