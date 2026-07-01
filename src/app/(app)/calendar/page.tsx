import { getSession } from "@/lib/auth";
import { listMeetings } from "@/lib/data-misc";
import { listPolls } from "@/lib/data-misc";
import MeetingForm from "@/components/MeetingForm";
import CalendarView from "@/components/CalendarView";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  await getSession();
  const [meetings, polls] = await Promise.all([listMeetings(), listPolls()]);
  const pollsLite = polls.map((p) => ({ token: p.token, title: p.title }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Kalendarz</h1>
          <p className="text-sm text-muted">Terminy planszówkowych spotkań</p>
        </div>
        <MeetingForm polls={pollsLite} />
      </div>

      <CalendarView meetings={meetings} polls={pollsLite} />
    </div>
  );
}
