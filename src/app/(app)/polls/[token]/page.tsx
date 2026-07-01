import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft, Dices, CalendarDays } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getPollByToken, getMeetingByPollToken } from "@/lib/data-misc";
import { displayNameOf } from "@/lib/users";
import { formatDate } from "@/components/ui";
import PollVoting from "@/components/PollVoting";

export const dynamic = "force-dynamic";

const WEEKDAYS_SHORT = ["ndz", "pon", "wt", "śr", "czw", "pt", "sob"];

export default async function PollPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = (await getSession())!;
  const [poll, linkedMeeting] = await Promise.all([
    getPollByToken(token, session.username),
    getMeetingByPollToken(token),
  ]);
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

      {/* Powiązane spotkanie */}
      {linkedMeeting && (() => {
        const d = new Date(linkedMeeting.date + "T00:00:00");
        const day = d.getDate();
        const weekday = WEEKDAYS_SHORT[d.getDay()];
        const month = d.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
        return (
          <Link
            href="/calendar"
            className="flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 transition hover:border-gold/60 hover:bg-gold/10"
          >
            <div className="flex w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-gold/15 py-1">
              <span className="font-mono text-lg font-bold leading-none text-gold">{day}</span>
              <span className="text-[10px] uppercase text-gold/70">{weekday}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium uppercase tracking-wide text-gold/70">
                Powiązane spotkanie
              </div>
              <div className="font-medium text-cream">{linkedMeeting.title}</div>
              <div className="text-xs text-muted capitalize">{month}</div>
            </div>
            <CalendarDays size={16} className="shrink-0 text-gold/50" />
          </Link>
        );
      })()}

      <PollVoting poll={poll} shareUrl={shareUrl} canManage={canManage} />
    </div>
  );
}
