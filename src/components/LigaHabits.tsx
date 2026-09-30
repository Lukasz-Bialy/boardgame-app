"use client";

import { useMemo } from "react";
import { Clock, Coffee, HeartHandshake, Hourglass, Lightbulb } from "lucide-react";
import { Avatar } from "@/components/ui";
import { displayNameOf } from "@/lib/users";
import { winrateStyle } from "@/components/LigaCharts";
import type { LeagueGame } from "@/lib/riot";

// Przerwa dłuższa niż tyle między końcem gry a startem następnej zaczyna nową sesję
const SESSION_GAP_MS = 60 * 60 * 1000;
const DURATIONS = [
  { max: 25, label: "< 25 min" },
  { max: 30, label: "25–30 min" },
  { max: 35, label: "30–35 min" },
  { max: 40, label: "35–40 min" },
  { max: Infinity, label: "40+ min" },
];

type WL = { n: number; w: number };
const wl = (): WL => ({ n: 0, w: 0 });
const pct = (s: WL) => (s.n ? `${Math.round((s.w / s.n) * 100)}%` : "—");
const rate = (s: WL) => (s.n ? s.w / s.n : 0.5);

function Bars({ items }: { items: { label: string; s: WL; note?: string }[] }) {
  return (
    <div className="flex items-end gap-2">
      {items.map(({ label, s, note }) => (
        <div key={label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="text-xs font-semibold tabular-nums">{pct(s)}</div>
          <div className="flex h-28 w-full items-end rounded-md bg-panel2/40">
            <div
              className="w-full rounded-md transition-all"
              style={{ height: `${s.n ? Math.max(4, rate(s) * 100) : 0}%`, ...winrateStyle(s.n ? rate(s) : 0.5) }}
            />
          </div>
          <div className="text-center text-[11px] leading-tight text-muted">
            {label}
            <div className="tabular-nums">{s.n ? `${s.w}–${s.n - s.w}` : "brak"}</div>
            {note && <div>{note}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Card({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel p-5">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold">
        {icon} {title}
      </h3>
      <p className="mb-4 text-xs text-muted">{subtitle}</p>
      {children}
    </section>
  );
}

export default function LigaHabits({ games, lineup }: { games: LeagueGame[]; lineup: string[] }) {
  const model = useMemo(() => {
    const set = new Set(lineup);
    // Jeden wpis na mecz: wynik drużyny, w której grało więcej osób ze składu
    const list = games
      .map((g) => {
        const mine = g.players.filter((p) => set.has(p.username) && !p.remake);
        if (!mine.length) return null;
        const teams = new Map<number, number>();
        for (const p of mine) teams.set(p.team, (teams.get(p.team) ?? 0) + 1);
        const team = [...teams.entries()].sort((a, b) => b[1] - a[1])[0][0];
        const members = mine.filter((p) => p.team === team);
        return {
          start: g.endedAt - g.duration * 1000,
          end: g.endedAt,
          minutes: g.duration / 60,
          win: members[0].win,
          members: members.map((p) => p.username),
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.start - b.start);

    // Sesje i numer gry w sesji
    const byIndex = [wl(), wl(), wl(), wl(), wl()]; // 1., 2., 3., 4., 5.+
    const afterWin = wl();
    const afterLoss = wl();
    const afterTwoLosses = wl();
    let sessions = 0;
    let sessionGames = 0;
    let prev: (typeof list)[number] | null = null;
    let index = 0;
    let streak = 0; // > 0 wygrane z rzędu, < 0 przegrane z rzędu (w sesji)
    for (const g of list) {
      const fresh = !prev || g.start - prev.end > SESSION_GAP_MS;
      if (fresh) {
        sessions++;
        index = 0;
        streak = 0;
      } else {
        const s = prev!.win ? afterWin : afterLoss;
        s.n++;
        s.w += g.win ? 1 : 0;
        if (streak <= -2) {
          afterTwoLosses.n++;
          afterTwoLosses.w += g.win ? 1 : 0;
        }
      }
      const slot = byIndex[Math.min(index, 4)];
      slot.n++;
      slot.w += g.win ? 1 : 0;
      index++;
      sessionGames++;
      streak = g.win ? Math.max(1, streak + 1) : Math.min(-1, streak - 1);
      prev = g;
    }

    const byDuration = DURATIONS.map(() => wl());
    for (const g of list) {
      const s = byDuration[DURATIONS.findIndex((d) => g.minutes < d.max)];
      s.n++;
      s.w += g.win ? 1 : 0;
    }

    // Duety: wspólne gry w jednej drużynie vs średni winrate obu osób w tym zakresie
    const solo = new Map(lineup.map((u) => [u, wl()]));
    for (const g of list)
      for (const u of g.members) {
        const s = solo.get(u)!;
        s.n++;
        s.w += g.win ? 1 : 0;
      }
    const duos: { a: string; b: string; s: WL; synergy: number }[] = [];
    for (let i = 0; i < lineup.length; i++)
      for (let j = i + 1; j < lineup.length; j++) {
        const [a, b] = [lineup[i], lineup[j]];
        const s = wl();
        for (const g of list)
          if (g.members.includes(a) && g.members.includes(b)) {
            s.n++;
            s.w += g.win ? 1 : 0;
          }
        if (s.n >= 3)
          duos.push({ a, b, s, synergy: rate(s) - (rate(solo.get(a)!) + rate(solo.get(b)!)) / 2 });
      }
    duos.sort((x, y) => y.synergy - x.synergy);

    // Wnioski
    const tips: string[] = [];
    const firstTwo = { n: byIndex[0].n + byIndex[1].n, w: byIndex[0].w + byIndex[1].w };
    const late = { n: byIndex[3].n + byIndex[4].n, w: byIndex[3].w + byIndex[4].w };
    if (late.n >= 5 && firstTwo.n >= 5 && rate(late) < rate(firstTwo) - 0.1)
      tips.push(
        `Po 3. grze w sesji winrate spada z ${pct(firstTwo)} do ${pct(late)} — zmęczenie robi swoje, rozważcie kończenie wieczoru wcześniej.`
      );
    if (afterTwoLosses.n >= 4 && rate(afterTwoLosses) < 0.45)
      tips.push(
        `Po 2 porażkach z rzędu wygrywacie tylko ${pct(afterTwoLosses)} kolejnych gier — to dobry moment na przerwę zamiast „jeszcze jednej”.`
      );
    if (afterLoss.n >= 5 && afterWin.n >= 5 && rate(afterWin) - rate(afterLoss) > 0.12)
      tips.push(`Po wygranej wygrywacie ${pct(afterWin)} następnych gier, po porażce ${pct(afterLoss)} — porażki wyraźnie Was rozbijają.`);
    const early = { n: byDuration[0].n + byDuration[1].n, w: byDuration[0].w + byDuration[1].w };
    const long = { n: byDuration[3].n + byDuration[4].n, w: byDuration[3].w + byDuration[4].w };
    if (early.n >= 5 && long.n >= 5 && Math.abs(rate(early) - rate(long)) > 0.12)
      tips.push(
        rate(early) > rate(long)
          ? `Lepiej wypadacie w krótkich meczach (${pct(early)} do 30 min vs ${pct(long)} powyżej 35) — wybierajcie championów na wczesną grę i kończcie mecze, póki macie przewagę.`
          : `Lepiej wypadacie w długich meczach (${pct(long)} powyżej 35 min vs ${pct(early)} do 30) — skład na późną grę i cierpliwość w pierwszych minutach się opłacają.`
      );
    // Pojedynczy przedział długości z wyraźnie złym wynikiem (np. mecze 40+ min)
    const badLen = DURATIONS.map((d, i) => ({ d, s: byDuration[i] }))
      .filter((x) => x.s.n >= 8 && rate(x.s) <= 0.38)
      .sort((a, b) => rate(a.s) - rate(b.s))[0];
    if (badLen)
      tips.push(
        `W meczach ${badLen.d.label} wygrywacie tylko ${pct(badLen.s)} (${badLen.s.w}–${badLen.s.n - badLen.s.w}) — ${
          badLen.d.max === Infinity || badLen.d.max >= 40
            ? "długie mecze Wam uciekają: z przewagą kończcie grę Baronem i wieżami, zamiast czekać, a w późnej grze nie dawajcie się łapać pojedynczo."
            : "krótkie mecze to zwykle przegrane fazy linii albo szybkie poddania — grajcie bezpieczniej na początku."
        }`
      );
    if (duos[0] && duos[0].synergy > 0.1)
      tips.push(
        `Najlepszy duet: ${displayNameOf(duos[0].a)} + ${displayNameOf(duos[0].b)} — razem ${pct(duos[0].s)}, o ${Math.round(duos[0].synergy * 100)} pp więcej niż ich średnia.`
      );

    return { list, byIndex, afterWin, afterLoss, afterTwoLosses, sessions, sessionGames, byDuration, duos, tips };
  }, [games, lineup]);

  if (!lineup.length)
    return <div className="panel p-8 text-center text-sm text-muted">Zaznacz w filtrze „Gracze” osoby do analizy.</div>;
  if (model.list.length < 5)
    return (
      <div className="panel p-8 text-center text-sm text-muted">
        Za mało meczów w wybranym zakresie — wybierz dłuższy zakres dat (np. 90 dni).
      </div>
    );

  return (
    <div className="space-y-4">
      {model.tips.length > 0 && (
        <section className="panel border-gold/40 p-5">
          <h3 className="mb-2 flex items-center gap-2 font-display text-lg font-bold">
            <Lightbulb size={18} className="text-gold" /> Wnioski
          </h3>
          <ul className="space-y-1.5 text-sm">
            {model.tips.map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-gold">•</span> {t}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title="Która gra wieczoru"
          subtitle={`Winrate wg numeru gry w sesji (nowa sesja po 60+ min przerwy) · ${model.sessions} sesji, średnio ${(
            model.sessionGames / Math.max(1, model.sessions)
          ).toFixed(1)} gry`}
          icon={<Clock size={18} />}
        >
          <Bars items={["1. gra", "2. gra", "3. gra", "4. gra", "5.+"].map((label, i) => ({ label, s: model.byIndex[i] }))} />
        </Card>

        <Card
          title="Tilt"
          subtitle="Winrate następnej gry w tej samej sesji, zależnie od wyniku poprzednich"
          icon={<Coffee size={18} />}
        >
          <Bars
            items={[
              { label: "po wygranej", s: model.afterWin },
              { label: "po porażce", s: model.afterLoss },
              { label: "po 2+ porażkach z rzędu", s: model.afterTwoLosses },
            ]}
          />
        </Card>

        <Card title="Długość meczu" subtitle="Wczesna czy późna gra — w których meczach wypadacie lepiej" icon={<Hourglass size={18} />}>
          <Bars items={DURATIONS.map((d, i) => ({ label: d.label, s: model.byDuration[i] }))} />
        </Card>

        <Card
          title="Duety"
          subtitle="Wspólne gry w jednej drużynie (min. 3) · synergia = winrate razem minus średni winrate obu osób"
          icon={<HeartHandshake size={18} />}
        >
          {model.duos.length === 0 ? (
            <div className="py-3 text-xs text-muted">Za mało wspólnych gier.</div>
          ) : (
            <div className="divide-y divide-line/30">
              {model.duos.map((d) => (
                <div key={d.a + d.b} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="flex -space-x-1.5">
                    <Avatar username={d.a} size={22} />
                    <Avatar username={d.b} size={22} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {displayNameOf(d.a)} + {displayNameOf(d.b)}
                  </span>
                  <span className="w-12 text-right font-mono text-xs text-muted">
                    {d.s.w}–{d.s.n - d.s.w}
                  </span>
                  <span className="w-12 rounded-md px-1.5 py-0.5 text-center font-mono text-xs font-semibold" style={winrateStyle(rate(d.s))}>
                    {pct(d.s)}
                  </span>
                  <span
                    className={`w-14 text-right font-mono text-xs ${
                      Math.round(d.synergy * 100) > 0 ? "text-felt" : Math.round(d.synergy * 100) < 0 ? "text-danger" : "text-muted"
                    }`}
                  >
                    {Math.round(d.synergy * 100) > 0 ? "+" : Math.round(d.synergy * 100) < 0 ? "−" : "±"}
                    {Math.abs(Math.round(d.synergy * 100))} pp
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
