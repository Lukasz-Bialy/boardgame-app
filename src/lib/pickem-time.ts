// Godziny meczów zawsze w czasie polskim — serwer (UTC) i przeglądarka renderują to samo,
// a admin wpisuje godzinę tak, jak podaje ją polska transmisja
export const TZ = "Europe/Warsaw";

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function warsawParts(ms: number) {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO (UTC) → wartość pola datetime-local w czasie polskim, np. "2026-10-10T11:00" */
export function isoToWarsawInput(iso: string): string {
  const p = warsawParts(new Date(iso).getTime());
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/** Wartość pola datetime-local (czas polski) → ISO (UTC) */
export function warsawInputToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Przesunięcie strefy w tej chwili (zimą +1 h, latem +2 h); drugi krok poprawia okolice zmiany czasu
  const offset = (ms: number) => {
    const p = warsawParts(ms);
    return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - ms;
  };
  let ms = asUtc - offset(asUtc);
  ms = asUtc - offset(ms);
  return new Date(ms).toISOString();
}

const dayFmt = new Intl.DateTimeFormat("pl-PL", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("pl-PL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

/** "sob., 10 paź · 11:00" */
export function formatMatchTime(iso: string): string {
  const d = new Date(iso);
  return `${dayFmt.format(d)} · ${timeFmt.format(d)}`;
}

/** "za 3 dni", "za 5 h", "za 12 min" */
export function timeLeft(iso: string, now: number): string {
  const min = Math.max(0, Math.round((new Date(iso).getTime() - now) / 60000));
  if (min < 60) return `za ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `za ${h} h`;
  const d = Math.round(h / 24);
  return `za ${d} dni`;
}
