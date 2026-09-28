"use client";

import { useMemo } from "react";
import { Info, Sparkles, Users } from "lucide-react";
import { Avatar } from "@/components/ui";
import { displayNameOf } from "@/lib/users";
import { winrateStyle } from "@/components/LigaCharts";
import type { LeagueGame } from "@/lib/riot";

const ROLES = [
  ["TOP", "Top"],
  ["JUNGLE", "Jungle"],
  ["MIDDLE", "Mid"],
  ["BOTTOM", "ADC"],
  ["UTILITY", "Support"],
] as const;
type Role = (typeof ROLES)[number][0];
const ROLE_KEYS = ROLES.map((r) => r[0]) as Role[];
const roleLabel = (r: Role) => ROLES.find((x) => x[0] === r)![1];

/* ─── Model ───────────────────────────────────────────────────────────────────
   Waga gry dla wybranego składu S (k osób):
   • ten sam skład — w drużynie byli dokładnie gracze z S: 1,0
   • każda inna gra: 0,10 (solo / bez nikogo z S) … 0,30 (prawie cały skład),
     liniowo wg liczby osób z S w drużynie.
   Winrate na roli „ściągamy” do wartości wyjściowej, gdy ważonych gier jest mało
   (A = siła ściągania, w jednostkach wagi). Wartość wyjściowa: 44% bez doświadczenia
   na roli, rośnie do 50% przy 10+ grach — brak ogrania na roli obniża ocenę.
   Championy: ogranie championa to głównie umiejętność gracza, więc waga gier spoza składu
   jest tu wyższa (min. W_CHAMP_MIN), a przyciąganie do 50% mocniejsze. */
const W_EXACT = 1;
const W_MIN = 0.1;
const W_MAX_OTHER = 0.3;
const A_ROLE = 5;
const A_CHAMP = 4;
const W_CHAMP_MIN = 0.4;

type Stat = { w: number; n: number; wins: number; games: number; exact: number };
const empty = (): Stat => ({ w: 0, n: 0, wins: 0, games: 0, exact: 0 });

function roleScore(s: Stat) {
  const prior = 0.44 + 0.06 * Math.min(1, s.games / 10);
  return (s.w + A_ROLE * prior) / (s.n + A_ROLE);
}

const champScore = (s: Stat) => (s.w + A_CHAMP * 0.5) / (s.n + A_CHAMP);

function gameWeight(teamClub: string[], lineup: Set<string>): { weight: number; exact: boolean } {
  const k = lineup.size;
  const inLineup = teamClub.filter((u) => lineup.has(u)).length;
  const exact = inLineup === k && teamClub.length === k;
  if (exact) return { weight: W_EXACT, exact };
  return { weight: W_MIN + ((W_MAX_OTHER - W_MIN) * (inLineup - 1)) / Math.max(k - 1, 1), exact };
}

type Assignment = { roles: Record<string, Role>; score: number };

// Wszystkie przypisania k graczy do różnych ról (max 5·4·3·2·1 = 120) — wybieramy najlepsze
function assignments(players: string[], score: (u: string, r: Role) => number): Assignment[] {
  const out: Assignment[] = [];
  const walk = (i: number, used: Set<Role>, acc: Record<string, Role>, sum: number) => {
    if (i === players.length) {
      out.push({ roles: { ...acc }, score: sum / players.length });
      return;
    }
    for (const r of ROLE_KEYS) {
      if (used.has(r)) continue;
      used.add(r);
      acc[players[i]] = r;
      walk(i + 1, used, acc, sum + score(players[i], r));
      used.delete(r);
    }
  };
  walk(0, new Set(), {}, 0);
  return out.sort((a, b) => b.score - a.score);
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

// Pewność wg ważonej liczby gier (gra tego składu = 1, solo = 0,1)
function confidence(n: number) {
  if (n >= 8) return { label: "wysoka pewność", cls: "text-cream" };
  if (n >= 3) return { label: "średnia pewność", cls: "text-muted" };
  return { label: "niska pewność", cls: "text-gold" };
}

function diffLabel(d: number) {
  const pp = Math.round(d * 1000) / 10;
  return pp === 0 ? "tyle samo" : `${pp > 0 ? "+" : "−"}${Math.abs(pp).toLocaleString("pl-PL")} pp`;
}
const gier = (n: number) =>
  n === 1 ? "1 gra" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? `${n} gry` : `${n} gier`;

/* ─── Widok ─────────────────────────────────────────────────────────────────── */

export default function LigaAnalytics({
  games,
  lineup,
  ver,
  rangeDays,
  onWiderRange,
}: {
  games: LeagueGame[]; // już po filtrze typu gry
  lineup: string[];
  ver: string;
  rangeDays: number;
  onWiderRange: () => void;
}) {
  const model = useMemo(() => {
    const set = new Set(lineup);
    const role = new Map<string, Map<Role, Stat>>();
    const champ = new Map<string, Map<Role, Map<string, Stat>>>();
    for (const u of lineup) {
      role.set(u, new Map(ROLE_KEYS.map((r) => [r, empty()])));
      champ.set(u, new Map(ROLE_KEYS.map((r) => [r, new Map()])));
    }
    const exactGames = new Set<string>();
    let roleGames = 0;

    for (const g of games) {
      if (g.arena) continue;
      for (const p of g.players) {
        const r = p.position as Role;
        if (!set.has(p.username) || p.remake || !ROLE_KEYS.includes(r)) continue;
        const teamClub = g.players.filter((x) => x.team === p.team).map((x) => x.username);
        const { weight, exact } = gameWeight(teamClub, set);
        if (exact) exactGames.add(g.id);
        roleGames++;
        const add = (s: Stat, weight: number) => {
          s.n += weight;
          s.w += p.win ? weight : 0;
          s.games++;
          s.wins += p.win ? 1 : 0;
          s.exact += exact ? 1 : 0;
        };
        add(role.get(p.username)!.get(r)!, weight);
        const cm = champ.get(p.username)!.get(r)!;
        if (!cm.has(p.champion)) cm.set(p.champion, empty());
        add(cm.get(p.champion)!, Math.max(W_CHAMP_MIN, weight));
      }
    }

    const ranked = lineup.length ? assignments(lineup, (u, r) => roleScore(role.get(u)!.get(r)!)) : [];
    return { role, champ, ranked, exactGames: exactGames.size, roleGames };
  }, [games, lineup]);

  if (lineup.length === 0) {
    return (
      <div className="panel p-8 text-center text-sm text-muted">
        Zaznacz w filtrze „Gracze” osoby, które grają razem (1–5).
      </div>
    );
  }

  const best = model.ranked[0];
  const alternatives = model.ranked.slice(1, 3);
  const thin = model.roleGames < 15 * lineup.length;

  const topChamps = (u: string, r: Role) =>
    [...model.champ.get(u)!.get(r)!.entries()]
      .map(([name, s]) => ({ name, s, score: champScore(s) }))
      .sort((a, b) => b.score - a.score || b.s.games - a.s.games)
      .slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Kontekst: skład i ilość danych */}
      <div className="panel flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
        <div className="flex items-center gap-3">
          <span className="flex -space-x-2">
            {lineup.map((u) => (
              <span key={u} className="rounded-full ring-2 ring-panel">
                <Avatar username={u} size={30} />
              </span>
            ))}
          </span>
          <div>
            <div className="text-sm font-semibold">Skład: {lineup.map(displayNameOf).join(", ")}</div>
            <div className="text-xs text-muted">zmieniasz go filtrem „Gracze” powyżej</div>
          </div>
        </div>
        <div>
          <div className="text-xl font-bold">{model.exactGames}</div>
          <div className="text-[11px] uppercase tracking-wider text-muted" title="Gry, w których wszyscy wybrani byli w jednej drużynie (i nikt inny z ekipy)">
            gier tego składu razem
          </div>
        </div>
        <div>
          <div className="text-xl font-bold">{model.roleGames}</div>
          <div className="text-[11px] uppercase tracking-wider text-muted">występów na rolach</div>
        </div>
        {thin && (
          <div className="flex items-center gap-2 text-xs text-gold">
            <Info size={14} className="shrink-0" /> Mało danych — rekomendacje są orientacyjne.
            {rangeDays < 90 && (
              <button className="btn-ghost px-2 py-1 text-xs" onClick={onWiderRange}>
                Użyj 90 dni
              </button>
            )}
          </div>
        )}
      </div>

      {/* Rekomendowany podział ról */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
          <Sparkles size={18} /> Rekomendowany podział ról
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {ROLE_KEYS.map((r) => {
            const u = Object.keys(best.roles).find((x) => best.roles[x] === r);
            if (!u)
              return (
                <div key={r} className="panel flex flex-col gap-2 p-4 opacity-60">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{roleLabel(r)}</div>
                  <div className="text-sm text-muted">wolne — ktoś spoza składu</div>
                </div>
              );
            const s = model.role.get(u)!.get(r)!;
            const champs = topChamps(u, r);
            return (
              <div key={r} className="panel flex flex-col gap-3 p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{roleLabel(r)}</div>
                <div className="flex items-center gap-2.5">
                  <Avatar username={u} size={34} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{displayNameOf(u)}</div>
                    <div className="text-xs text-muted">
                      {s.games ? `na tej roli: ${gier(s.games)} · ${s.wins}–${s.games - s.wins}` : "bez gier na tej roli"}
                    </div>
                    {model.exactGames > 0 && (
                      <div className="text-xs text-muted">
                        w tym {s.exact} z {model.exactGames} gier tego składu
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{pct(roleScore(s))}</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted">
                    szacowany winrate ·{" "}
                    <span className={confidence(s.n).cls}>{confidence(s.n).label}</span>
                  </div>
                </div>
                <div className="space-y-1.5 border-t border-line/50 pt-3">
                  {champs.length === 0 ? (
                    <div className="text-xs text-muted">Brak championów na tej roli</div>
                  ) : (
                    champs.map(({ name, s: cs, score }) => (
                      <div key={name} className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${name}.png`}
                          alt=""
                          width={24}
                          height={24}
                          loading="lazy"
                          className="h-6 w-6 rounded-md ring-1 ring-line/60"
                        />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">{name}</span>
                        <span className="text-xs font-semibold tabular-nums">{pct(score)}</span>
                        <span className="w-9 text-right text-[11px] tabular-nums text-muted">
                          {cs.wins}–{cs.games - cs.wins}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {alternatives.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {alternatives.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                <span className="font-medium text-cream">Wariant {i + 2}</span>
                {ROLE_KEYS.map((r) => {
                  const u = Object.keys(a.roles).find((x) => a.roles[x] === r);
                  return u ? (
                    <span key={r}>
                      {roleLabel(r)}: <span className="text-cream">{displayNameOf(u)}</span>
                    </span>
                  ) : null;
                })}
                <span className="tabular-nums">
                  średnio {pct(a.score)} ({diffLabel(a.score - best.score)})
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Macierz: każdy gracz na każdej roli */}
      <section className="panel p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold">Gracze na rolach</h3>
            <p className="text-xs text-muted">
              Szacowany winrate po wagach · pod spodem surowy bilans W–P · obwódka = rekomendacja
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted" aria-label="Skala winrate">
            <span>0%</span>
            <span
              className="h-2.5 w-28 rounded-full"
              style={{ background: "linear-gradient(90deg, var(--viz-neg), var(--viz-mid), var(--viz-pos))" }}
            />
            <span>100%</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] table-fixed border-separate" style={{ borderSpacing: 3 }}>
            <thead>
              <tr>
                <th className="w-28" />
                {ROLES.map(([r, l]) => (
                  <th key={r} className="pb-1 text-center text-[11px] font-medium text-muted">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineup.map((u) => (
                <tr key={u}>
                  <th scope="row" className="pr-3 text-left text-xs font-semibold text-muted">
                    {displayNameOf(u)}
                    {model.exactGames > 0 && (
                      <div className="text-[10px] font-normal tabular-nums">
                        {ROLE_KEYS.reduce((a, r) => a + model.role.get(u)!.get(r)!.exact, 0)} gier składu
                      </div>
                    )}
                  </th>
                  {ROLE_KEYS.map((r) => {
                    const s = model.role.get(u)!.get(r)!;
                    const picked = best.roles[u] === r;
                    if (s.games === 0)
                      return (
                        <td
                          key={r}
                          className={`h-12 rounded-md bg-panel2/40 text-center text-xs text-muted/60 ${
                            picked ? "ring-2 ring-cream" : ""
                          }`}
                          title={`${displayNameOf(u)} · ${roleLabel(r)}: brak gier (ocena ${pct(roleScore(s))})`}
                        >
                          —
                        </td>
                      );
                    return (
                      <td
                        key={r}
                        className={`h-12 rounded-md text-center ${picked ? "ring-2 ring-cream" : ""}`}
                        style={winrateStyle(roleScore(s))}
                        title={`${displayNameOf(u)} · ${roleLabel(r)}: ${gier(s.games)}, w tym ${s.exact} z ${model.exactGames} gier tego składu`}
                      >
                        <div className="text-sm font-bold leading-tight">{pct(roleScore(s))}</div>
                        <div className="text-[10px] leading-tight tabular-nums opacity-80">
                          {s.wins}–{s.games - s.wins}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <details className="panel p-4 text-sm">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold">
          <Users size={15} /> Jak to liczymy
        </summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs text-muted">
          <li>
            Liczą się gry z rolami (Summoner&apos;s Rift) z wybranego zakresu dat i typów gry — Arena i ARAM nie mają ról.
            Filtr „Premade” tutaj nie działa, zastępują go wagi.
          </li>
          <li>
            Gra <span className="text-cream">w dokładnie tym składzie</span> (w drużynie byli wszyscy wybrani i nikt
            inny z ekipy) ma wagę <span className="text-cream">1,0</span>. Każda inna gra ma wagę od 0,10 (solo) do 0,30
            — tym wyższą, im więcej osób z wybranego składu grało razem.
          </li>
          <li>
            Przy małej liczbie gier winrate jest przyciągany do wartości wyjściowej: 44% dla roli bez doświadczenia, do
            50% przy 10+ grach. Dzięki temu 2 wygrane na nowej roli nie dają 100%, a rola nieograna nie wygrywa z
            mainem.
          </li>
          <li>
            Podział ról to przypisanie z najwyższym średnim szacowanym winrate spośród wszystkich możliwych.
          </li>
          <li>
            Championy: gry spoza składu mają tu wagę co najmniej 0,40 — to, czy ktoś umie grać danym championem, zależy
            głównie od niego, nie od składu. Pojedyncza wygrana nie przebije championa ogranego z dobrym bilansem.
          </li>
          <li>
            Pewność zależy od ważonej liczby gier na roli: niska poniżej 3, wysoka od 8 (gra tego składu liczy się jak 10
            gier solo).
          </li>
        </ul>
      </details>
    </div>
  );
}
