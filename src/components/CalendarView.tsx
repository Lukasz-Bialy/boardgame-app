"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, StickyNote, Vote, Link2, Link2Off, Check, X } from "lucide-react";
import { api } from "@/lib/client";
import { Avatar } from "@/components/ui";
import { displayNameOf } from "@/lib/users";
import DeleteButton from "@/components/DeleteButton";
import type { MeetingWithPoll } from "@/lib/types";

type PollLite = { token: string; title: string };

const MONTHS = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
];
const WEEKDAYS = ["pon", "wt", "śr", "czw", "pt", "sob", "ndz"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Inline link editor ───────────────────────────────────────────────────────

function PollLinkEditor({
  meetingId,
  currentToken,
  polls,
}: {
  meetingId: string;
  currentToken: string | null;
  polls: PollLite[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(currentToken ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await api(`/api/meetings/${meetingId}`, "PATCH", {
      poll_token: selected || null,
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  function cancel() {
    setSelected(currentToken ?? "");
    setEditing(false);
  }

  if (!editing) {
    if (currentToken) {
      const poll = polls.find((p) => p.token === currentToken);
      return (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Link
            href={`/polls/${currentToken}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-felt/40 bg-felt/10 px-2 py-0.5 text-xs font-medium text-felt hover:bg-felt/20 transition"
          >
            <Vote size={11} />
            {poll?.title ?? "Ankieta"}
          </Link>
          <button
            onClick={() => setEditing(true)}
            className="rounded p-0.5 text-muted hover:text-cream transition"
            title="Zmień powiązaną ankietę"
          >
            <Link2 size={13} />
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={() => setEditing(true)}
        className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-felt transition"
        title="Powiąż z ankietą"
      >
        <Link2 size={12} /> Połącz z ankietą
      </button>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-1.5">
      <select
        className="input py-1 text-xs flex-1"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        autoFocus
      >
        <option value="">— brak powiązania —</option>
        {polls.map((p) => (
          <option key={p.token} value={p.token}>
            {p.title}
          </option>
        ))}
      </select>
      <button
        onClick={save}
        disabled={saving}
        className="rounded-lg border border-felt/50 bg-felt/15 p-1.5 text-felt hover:bg-felt/25 transition disabled:opacity-50"
        title="Zapisz"
      >
        <Check size={13} />
      </button>
      <button
        onClick={cancel}
        className="rounded-lg border border-line p-1.5 text-muted hover:text-cream transition"
        title="Anuluj"
      >
        <X size={13} />
      </button>
      {currentToken && (
        <button
          onClick={() => { setSelected(""); }}
          className="rounded-lg border border-danger/40 p-1.5 text-danger hover:bg-danger/10 transition"
          title="Usuń powiązanie"
        >
          <Link2Off size={13} />
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalendarView({
  meetings,
  polls,
}: {
  meetings: MeetingWithPoll[];
  polls: PollLite[];
}) {
  const router = useRouter();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const byDay = useMemo(() => {
    const map: Record<string, MeetingWithPoll[]> = {};
    for (const m of meetings) (map[m.date] ??= []).push(m);
    return map;
  }, [meetings]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayStr = ymd(today);

  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthMeetings = meetings
    .filter((m) => {
      const d = new Date(m.date + "T00:00:00");
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  function shift(delta: number) {
    setCursor(new Date(year, month + delta, 1));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Siatka miesiąca */}
      <div className="panel p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <button className="btn-ghost" onClick={() => shift(-1)} aria-label="Poprzedni miesiąc">
            <ChevronLeft size={18} />
          </button>
          <h2 className="font-display text-xl font-bold capitalize">
            {MONTHS[month]} {year}
          </h2>
          <button className="btn-ghost" onClick={() => shift(1)} aria-label="Następny miesiąc">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1 font-medium">{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const has = byDay[ds];
            const isToday = ds === todayStr;
            const hasPoll = has?.some((m) => m.poll_token);
            return (
              <div
                key={i}
                className={`flex aspect-square flex-col items-center justify-start rounded-lg border p-1 text-sm ${
                  has ? "border-felt/60 bg-felt/10" : "border-line"
                } ${isToday ? "ring-1 ring-gold" : ""}`}
              >
                <span className={`font-mono ${isToday ? "text-gold" : "text-cream"}`}>{day}</span>
                {has && (
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-felt" aria-hidden />
                )}
                {hasPoll && (
                  <span className="mt-0.5 h-1 w-1 rounded-full bg-gold" aria-hidden title="Ma ankietę" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista spotkań */}
      <div className="space-y-3">
        <h3 className="font-display text-lg font-bold">
          Spotkania · <span className="capitalize">{MONTHS[month]}</span>
        </h3>
        {monthMeetings.length === 0 ? (
          <p className="text-sm text-muted">Brak spotkań w tym miesiącu.</p>
        ) : (
          monthMeetings.map((m) => {
            const d = new Date(m.date + "T00:00:00");
            return (
              <div key={m.id} className="panel flex gap-3 p-3.5">
                <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-panel2 py-1">
                  <span className="font-mono text-lg font-bold leading-none text-felt">
                    {d.getDate()}
                  </span>
                  <span className="text-[10px] uppercase text-muted">
                    {WEEKDAYS[(d.getDay() + 6) % 7]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium leading-tight">{m.title}</p>
                    <DeleteButton
                      url={`/api/meetings/${m.id}`}
                      confirmText={`Usunąć spotkanie „${m.title}"?`}
                      iconOnly
                    />
                  </div>
                  {m.note && (
                    <p className="mt-1 inline-flex items-start gap-1 text-sm text-muted">
                      <StickyNote size={13} className="mt-0.5 shrink-0" /> {m.note}
                    </p>
                  )}
                  <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted">
                    <Avatar username={m.created_by} size={16} /> {displayNameOf(m.created_by)}
                  </p>
                  <PollLinkEditor
                    meetingId={m.id}
                    currentToken={m.poll_token}
                    polls={polls}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
