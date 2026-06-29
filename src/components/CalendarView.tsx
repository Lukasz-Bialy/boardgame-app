"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, StickyNote } from "lucide-react";
import { api } from "@/lib/client";
import { Avatar } from "@/components/ui";
import { displayNameOf } from "@/lib/users";
import DeleteButton from "@/components/DeleteButton";
import type { Meeting } from "@/lib/types";

const MONTHS = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
];
const WEEKDAYS = ["pon", "wt", "śr", "czw", "pt", "sob", "ndz"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function CalendarView({ meetings }: { meetings: Meeting[] }) {
  const router = useRouter();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const byDay = useMemo(() => {
    const map: Record<string, Meeting[]> = {};
    for (const m of meetings) (map[m.date] ??= []).push(m);
    return map;
  }, [meetings]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayStr = ymd(today);

  // Poniedziałek jako pierwszy dzień tygodnia.
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
            <div key={d} className="py-1 font-medium">
              {d}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const has = byDay[ds];
            const isToday = ds === todayStr;
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
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista spotkań w miesiącu */}
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
                  <span className="text-[10px] uppercase text-muted">{WEEKDAYS[(d.getDay() + 6) % 7]}</span>
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
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
