// Analiza meczów na żądanie: co idzie najgorzej indywidualnie i drużynowo.
// Punkt odniesienia jest zawsze z tych samych meczów — gracz vs jego rywal z linii, drużyna vs przeciwnicy —
// więc wynik nie zależy od rangi ani od tego, jak trudny był mecz. Moduł bez zależności serwerowych.

import { displayNameOf } from "./users";

/* ─── Dane wejściowe (przycięte szczegóły meczu z riot-details.ts) ─── */

export type DetailPlayer = {
  pid: number; // participantId 1–10
  puuid: string;
  teamId: number;
  position: string;
  champion: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  gold: number;
  cs: number;
  damage: number;
  damageTaken: number;
  vision: number;
  wardsPlaced: number;
  wardsKilled: number;
  controlWards: number;
  timeDead: number; // s
  objDamage: number;
  turretTakedowns: number;
  firstBlood: boolean;
  soloKills: number;
  plates: number;
  epicTakedowns: number; // smoki + barony + heraldy
  kp: number;
  dmgPct: number;
  takenPct: number;
  skillshotsDodged: number;
  skillshotsHit: number;
};

export type DetailEvent =
  | { k: "kill"; t: number; killer: number; victim: number; assists: number[]; x: number; y: number }
  | { k: "monster"; t: number; team: number; type: string; sub?: string }
  | { k: "building"; t: number; lost: number; type: string; lane?: string };

export type DetailMatch = {
  v: number;
  id: string;
  queueId: number;
  gameMode: string;
  duration: number; // s
  endedAt: number;
  remake: boolean;
  teams: { teamId: number; win: boolean; objectives: Record<string, { first: boolean; kills: number }> }[];
  players: DetailPlayer[]; // w kolejności participantId
  frames: number[][][]; // [minuta][gracz] → [złoto, xp, cs, x, y]
  events: DetailEvent[];
};

/* ─── Wynik ─── */

export type Insight = {
  key: string;
  title: string;
  detail: string;
  tip: string;
  severity: number; // < 0 — słabość, > 0 — mocna strona (w „typowych różnicach”)
};

export type PlayerReport = {
  username: string;
  games: number;
  roles: string[];
  champions: string[];
  weaknesses: Insight[];
  strengths: Insight[];
};

export type Moment = { t: number; text: string; tone: "good" | "bad" | "neutral" }; // t — sekunda meczu

export type AnalysisResult = {
  games: number;
  wins: number;
  avgMinutes: number;
  team: {
    weaknesses: Insight[];
    strengths: Insight[];
    objectives: { label: string; ours: number; theirs: number }[]; // średnio na mecz
    goldCurve: { minute: number; diff: number; n: number }[];
  };
  players: PlayerReport[];
  single: { id: string; win: boolean; minutes: number; moments: Moment[] } | null;
};

/* ─── Pomocnicze ─── */

const MIN = 60_000;
const ROLE_LABEL: Record<string, string> = { TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid", BOTTOM: "ADC", UTILITY: "Support" };
const MONSTER_LABEL: Record<string, string> = {
  DRAGON: "smoka",
  BARON_NASHOR: "Barona",
  RIFTHERALD: "Heralda",
  HORDE: "Grubsa",
  ATAKHAN: "Atakhana",
};
const DRAGON_LABEL: Record<string, string> = {
  FIRE_DRAGON: "ognistego smoka",
  WATER_DRAGON: "wodnego smoka",
  EARTH_DRAGON: "ziemnego smoka",
  AIR_DRAGON: "powietrznego smoka",
  HEXTECH_DRAGON: "hextechowego smoka",
  CHEMTECH_DRAGON: "chemtechowego smoka",
  ELDER_DRAGON: "Starszego Smoka",
};

const num = (v: number, digits = 1) => v.toLocaleString("pl-PL", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
const signed = (v: number, digits = 0) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${num(Math.abs(v), digits)}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const gier = (n: number) =>
  n === 1 ? "1 gra" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? `${n} gry` : `${n} gier`;

// Kontekst jednego meczu z perspektywy „naszej” drużyny
type Ctx = {
  m: DetailMatch;
  ours: number; // teamId
  us: DetailPlayer[];
  them: DetailPlayer[];
  minutes: number;
};

const idx = (p: DetailPlayer) => p.pid - 1;
const frame = (c: Ctx, minute: number) => c.m.frames[minute];
const goldAt = (c: Ctx, p: DetailPlayer, minute: number) => frame(c, minute)?.[idx(p)]?.[0];
const teamGoldAt = (c: Ctx, team: DetailPlayer[], minute: number) =>
  frame(c, minute) ? team.reduce((a, p) => a + frame(c, minute)[idx(p)][0], 0) : undefined;
const rivalOf = (c: Ctx, p: DetailPlayer) =>
  p.position ? c.m.players.find((x) => x.teamId !== p.teamId && x.position === p.position) : undefined;
const kills = (c: Ctx) => c.m.events.filter((e): e is Extract<DetailEvent, { k: "kill" }> => e.k === "kill");
const monsters = (c: Ctx) => c.m.events.filter((e): e is Extract<DetailEvent, { k: "monster" }> => e.k === "monster");

// Zgony gracza w ciągu 60 s przed celem zdobytym przez drużynę przeciwną
function deathsBeforeEnemyObjectives(c: Ctx, p: DetailPlayer): number {
  const enemyObjs = monsters(c).filter((e) => e.team !== p.teamId);
  return kills(c).filter((k) => k.victim === p.pid && enemyObjs.some((o) => o.t >= k.t && o.t - k.t <= MIN)).length;
}

// Czy w chwili zgonu w pobliżu nie było sojusznika (pozycje z klatek co minutę — szacunek)
function isolatedDeath(c: Ctx, k: Extract<DetailEvent, { k: "kill" }>): boolean {
  const victim = c.m.players[k.victim - 1];
  if (!victim) return false;
  const allies = c.m.players.filter((x) => x.teamId === victim.teamId && x.pid !== victim.pid);
  const minute = Math.floor(k.t / MIN);
  let nearest = Infinity;
  for (const f of [c.m.frames[minute], c.m.frames[minute + 1]]) {
    if (!f) continue;
    for (const a of allies) {
      const [, , , x, y] = f[idx(a)];
      nearest = Math.min(nearest, Math.hypot(x - k.x, y - k.y));
    }
  }
  return nearest > 2800;
}

/* ─── Metryki gracza: [on, rywal z linii] w jednym meczu ─── */

type PlayerMetric = {
  key: string;
  label: string;
  better: "higher" | "lower";
  scale: number; // różnica uznawana za wyraźną
  diff?: boolean; // pokazuj jako różnicę (np. +300 złota), a nie „x vs y”
  unit?: string;
  fmt?: (v: number) => string;
  get: (c: Ctx, p: DetailPlayer, r: DetailPlayer) => [number, number] | null;
  tip: (role: string) => string;
};

const PLAYER_METRICS: PlayerMetric[] = [
  {
    key: "gold10",
    label: "Złoto w 10. minucie",
    better: "higher",
    scale: 450,
    diff: true,
    unit: "złota",
    get: (c, p, r) => (c.m.frames.length > 10 ? [goldAt(c, p, 10)!, goldAt(c, r, 10)!] : null),
    tip: (role) =>
      role === "JUNGLE"
        ? "Słaby początek w jungli: sprawdź ścieżkę pierwszego clearu i czy nieudane ganki nie kosztują Cię campów — farmienie jungli to też złoto."
        : role === "UTILITY"
        ? "Słaba faza linii: pilnuj questa supporta i wymian — gdy ADC farmi, zabieraj rywalom HP, a nie odwrotnie."
        : "Przegrywasz fazę linii: farm bezpieczniej, wymieniaj się, gdy rywal podchodzi po miniona, i śledź, gdzie jest jungler wroga.",
  },
  {
    key: "gold15",
    label: "Złoto w 15. minucie",
    better: "higher",
    scale: 700,
    diff: true,
    unit: "złota",
    get: (c, p, r) => (c.m.frames.length > 15 ? [goldAt(c, p, 15)!, goldAt(c, r, 15)!] : null),
    tip: () =>
      "Wychodzisz z fazy linii w tyle: mniej niepotrzebnych powrotów do bazy, nie trać fal przy rotacjach i zbieraj plate'y, gdy masz przewagę.",
  },
  {
    key: "cs10",
    label: "CS w 10. minucie",
    better: "higher",
    scale: 12,
    diff: true,
    unit: "CS",
    get: (c, p, r) =>
      c.m.frames.length > 10 && p.position !== "UTILITY" ? [frame(c, 10)[idx(p)][2], frame(c, 10)[idx(r)][2]] : null,
    tip: (role) =>
      role === "JUNGLE"
        ? "Mniej campów niż rywal: pełny clear przed pierwszym gankiem i nie zostawiaj odrodzonych campów."
        : "Tracisz farmę: potrenuj last-hit w trybie praktyki (cel: 80+ CS w 10 min) i nie zostawiaj fal dla nieopłacalnych akcji.",
  },
  {
    key: "xp15",
    label: "Doświadczenie w 15. minucie",
    better: "higher",
    scale: 600,
    diff: true,
    unit: "XP",
    get: (c, p, r) => (c.m.frames.length > 15 ? [frame(c, 15)[idx(p)][1], frame(c, 15)[idx(r)][1]] : null),
    tip: () => "Rywal ma przewagę poziomów: za dużo czasu poza linią albo martwy — nie opuszczaj fal i wracaj do bazy po ich zepchnięciu.",
  },
  {
    key: "deathsEarly",
    label: "Zgony przed 14. minutą",
    better: "lower",
    scale: 0.8,
    fmt: (v) => num(v),
    get: (c, p, r) => {
      const early = (x: DetailPlayer) => kills(c).filter((k) => k.victim === x.pid && k.t < 14 * MIN).length;
      return [early(p), early(r)];
    },
    tip: () =>
      "Za dużo zgonów we wczesnej grze — każdy oddaje falę i plate'y. Stawiaj wardy na ścieżki junglera i graj ostrożniej, gdy nie widać go na mapie.",
  },
  {
    key: "soloDeaths",
    label: "Zgony w pojedynkach 1v1",
    better: "lower",
    scale: 0.8,
    fmt: (v) => num(v),
    get: (c, p, r) => {
      const solo = (x: DetailPlayer) =>
        kills(c).filter((k) => k.victim === x.pid && k.killer > 0 && k.assists.length === 0).length;
      return [solo(p), solo(r)];
    },
    tip: () =>
      "Częściej giniesz w pojedynkach bez pomocy: sprawdź power spike'i matchupu (poziomy 2, 3, 6 i pierwsze itemy) i nie wchodź w wymiany, gdy rywal jest silniejszy.",
  },
  {
    key: "isolated",
    label: "Zgony z dala od drużyny (szacunkowo)",
    better: "lower",
    scale: 1,
    fmt: (v) => num(v),
    get: (c, p, r) => {
      const iso = (x: DetailPlayer) =>
        kills(c).filter((k) => k.victim === x.pid && k.t >= 14 * MIN && isolatedDeath(c, k)).length;
      return [iso(p), iso(r)];
    },
    tip: () =>
      "Po fazie linii giniesz sam, bez sojuszników w pobliżu — nie farm bocznej linii bez wizji, zwłaszcza przed smokiem i baronem.",
  },
  {
    key: "deathsBeforeObj",
    label: "Zgony tuż przed celem przeciwnika",
    better: "lower",
    scale: 0.6,
    fmt: (v) => num(v),
    get: (c, p, r) => [deathsBeforeEnemyObjectives(c, p), deathsBeforeEnemyObjectives(c, r)],
    tip: () =>
      "Giniesz w minucie przed smokiem/baronem, który potem bierze przeciwnik — przed spawnem celu nie ryzykuj, a gdy brakuje Was w walce, oddaj cel zamiast walczyć w przewadze wroga.",
  },
  {
    key: "timeDead",
    label: "Czas martwy",
    better: "lower",
    scale: 0.04,
    fmt: pct,
    get: (c, p, r) => [p.timeDead / c.m.duration, r.timeDead / c.m.duration],
    tip: () => "Spędzasz dużo czasu martwy — to złoto i presja, których drużyna nie ma. Mniej ryzykownych wejść w późnej grze, gdy odrodzenie trwa długo.",
  },
  {
    key: "vision",
    label: "Vision score na minutę",
    better: "higher",
    scale: 0.35,
    fmt: (v) => num(v, 2),
    get: (c, p, r) => [p.vision / c.minutes, r.vision / c.minutes],
    tip: (role) =>
      role === "UTILITY" || role === "JUNGLE"
        ? "Słabsza wizja niż rywal: wymień trinket na sweeper po pierwszych itemach, wardy stawiaj przed celami, a nie po."
        : "Mało wizji: używaj trinketa od razu, gdy jest naładowany, i kupuj control warda przy każdym powrocie do bazy.",
  },
  {
    key: "wardsKilled",
    label: "Zniszczone wardy",
    better: "higher",
    scale: 2.5,
    fmt: (v) => num(v),
    get: (c, p, r) => [p.wardsKilled, r.wardsKilled],
    tip: () => "Rzadko niszczysz wardy wroga — control ward w rzece i sweeper przed celami odbierają przeciwnikowi informacje.",
  },
  {
    key: "controlWards",
    label: "Postawione control wardy",
    better: "higher",
    scale: 1.5,
    fmt: (v) => num(v),
    get: (c, p, r) => [p.controlWards, r.controlWards],
    tip: () => "Za mało control wardów — kosztują 75 złota, a dają stałą wizję w kluczowym miejscu. Kupuj jeden przy każdym powrocie.",
  },
  {
    key: "kp",
    label: "Udział w killach",
    better: "higher",
    scale: 0.12,
    fmt: pct,
    get: (c, p, r) => [p.kp, r.kp],
    tip: () => "Za mało udziału w akcjach drużyny — patrz częściej na minimapę i dołączaj do walk i celów, zamiast farmić w oddaleniu.",
  },
  {
    key: "dmgPct",
    label: "Udział w obrażeniach drużyny",
    better: "higher",
    scale: 0.06,
    fmt: pct,
    get: (c, p, r) => [p.dmgPct, r.dmgPct],
    tip: () => "Mały wkład w obrażenia — w walkach trzymaj pozycję, z której możesz bezpiecznie zadawać obrażenia, i sprawdź, czy build pasuje do meczu.",
  },
  {
    key: "epic",
    label: "Udział w smokach, baronach i heraldach",
    better: "higher",
    scale: 1.2,
    fmt: (v) => num(v),
    get: (c, p, r) => [p.epicTakedowns, r.epicTakedowns],
    tip: (role) =>
      role === "JUNGLE"
        ? "Rywal częściej zdobywa cele: planuj ścieżkę pod spawn smoka/heralda i zbieraj wsparcie linii 30–45 s wcześniej."
        : "Rzadko bierzesz udział w celach — przesuwaj się do rzeki, zanim cel się pojawi, szczególnie po zepchnięciu fali.",
  },
];

/* ─── Metryki drużyny: [my, przeciwnicy] w jednym meczu ─── */

type TeamMetric = {
  key: string;
  label: string;
  better: "higher" | "lower";
  scale: number;
  fmt?: (v: number) => string;
  objective?: boolean; // pokazuj też w tabeli celów
  get: (c: Ctx) => [number, number] | null;
  tip: string;
};

const obj = (c: Ctx, key: string): [number, number] | null => {
  const o = c.m.teams.find((t) => t.teamId === c.ours)?.objectives[key];
  const t = c.m.teams.find((t) => t.teamId !== c.ours)?.objectives[key];
  return o && t ? [o.kills, t.kills] : null;
};
const first = (c: Ctx, key: string): [number, number] | null => {
  const o = c.m.teams.find((t) => t.teamId === c.ours)?.objectives[key];
  const t = c.m.teams.find((t) => t.teamId !== c.ours)?.objectives[key];
  return o && t ? [o.first ? 1 : 0, t.first ? 1 : 0] : null;
};

const TEAM_METRICS: TeamMetric[] = [
  {
    key: "dragons",
    label: "Smoki",
    better: "higher",
    scale: 0.8,
    objective: true,
    get: (c) => obj(c, "dragon"),
    tip: "Planujcie smoki: zepchnijcie fale bot i mid 30–45 s przed spawnem, postawcie wizję w rzece, a jungler i support niech będą tam pierwsi.",
  },
  {
    key: "barons",
    label: "Barony",
    better: "higher",
    scale: 0.4,
    objective: true,
    get: (c) => obj(c, "baron"),
    tip: "Po wygranej walce albo zabiciu 2+ przeciwników od razu idźcie na Barona. Przed jego spawnem zróbcie wizję wokół pitu i czyśćcie wardy wroga.",
  },
  {
    key: "heralds",
    label: "Heraldy",
    better: "higher",
    scale: 0.4,
    objective: true,
    get: (c) => obj(c, "riftHerald"),
    tip: "Herald daje pierwsze wieże — top i jungler powinni grać pod niego razem, a mid pomagać, gdy ma pierwszeństwo na linii.",
  },
  {
    key: "grubs",
    label: "Grubsy (Void Grubs)",
    better: "higher",
    scale: 1.2,
    objective: true,
    get: (c) => obj(c, "horde"),
    tip: "Grubsy to wczesne cele strony top — jungler z topem (i midem z pierwszeństwem) powinni je zabierać, zamiast oddawać za darmo.",
  },
  {
    key: "towers",
    label: "Wieże",
    better: "higher",
    scale: 2,
    objective: true,
    get: (c) => obj(c, "tower"),
    tip: "Za mało wież — po wygranej walce albo zdobytym celu zamieniajcie przewagę na wieże, zamiast wracać do bazy.",
  },
  {
    key: "firstDragon",
    label: "Pierwszy smok",
    better: "higher",
    scale: 0.6,
    fmt: pct,
    get: (c) => first(c, "dragon"),
    tip: "Przeciwnicy częściej biorą pierwszego smoka — bot i jungler niech grają pod jego pierwszy spawn (5:00), a mid pomaga, gdy ma pierwszeństwo.",
  },
  {
    key: "firstTower",
    label: "Pierwsza wieża",
    better: "higher",
    scale: 0.6,
    fmt: pct,
    get: (c) => first(c, "tower"),
    tip: "Rzadko bierzecie pierwszą wieżę — wykorzystujcie Heralda i przewagę na linii, żeby ją zabrać przed 14:00, póki są plate'y.",
  },
  {
    key: "firstBlood",
    label: "Pierwsza krew",
    better: "higher",
    scale: 0.6,
    fmt: pct,
    get: (c) => first(c, "champion"),
    tip: "Przeciwnicy częściej zdobywają pierwszą krew — uważajcie na inwazje na starcie i wczesne ganki (wardy w jungli od pierwszej minuty).",
  },
  {
    key: "earlyDeaths",
    label: "Zgony przed 15. minutą",
    better: "lower",
    scale: 2,
    fmt: (v) => num(v),
    get: (c) => {
      const early = (team: number) =>
        kills(c).filter((k) => k.t < 15 * MIN && c.m.players[k.victim - 1]?.teamId === team).length;
      return [early(c.ours), early(c.them[0].teamId)];
    },
    tip: "Za dużo zgonów we wczesnej grze — grajcie bezpieczniej do pierwszych itemów i nie gońcie przeciwników pod ich wieżę.",
  },
  {
    key: "objAfterDeaths",
    label: "Cele oddane po zgonach",
    better: "lower",
    scale: 0.7,
    fmt: (v) => num(v),
    get: (c) => {
      const given = (team: number) =>
        monsters(c).filter(
          (o) =>
            o.team !== team &&
            kills(c).some((k) => c.m.players[k.victim - 1]?.teamId === team && k.t <= o.t && o.t - k.t <= MIN)
        ).length;
      return [given(c.ours), given(c.them[0].teamId)];
    },
    tip: "Przeciwnicy biorą cele zaraz po tym, jak ktoś z Was zginie. Przed spawnem smoka/barona trzymajcie się razem — lepiej oddać cel niż walczyć w osłabieniu.",
  },
  {
    key: "gold15",
    label: "Złoto drużyny w 15. minucie",
    better: "higher",
    scale: 1500,
    fmt: (v) => `${num(v / 1000)}k`,
    get: (c) => (c.m.frames.length > 15 ? [teamGoldAt(c, c.us, 15)!, teamGoldAt(c, c.them, 15)!] : null),
    tip: "Wychodzicie z fazy linii w tyle — wczesna gra to farma, plate'y i pierwsze cele; unikajcie walk, zanim macie pierwsze itemy.",
  },
  {
    key: "vision",
    label: "Vision score drużyny na minutę",
    better: "higher",
    scale: 1.2,
    fmt: (v) => num(v, 1),
    get: (c) => [
      c.us.reduce((a, p) => a + p.vision, 0) / c.minutes,
      c.them.reduce((a, p) => a + p.vision, 0) / c.minutes,
    ],
    tip: "Przeciwnicy widzą więcej — każdy powinien używać trinketa i kupować control wardy; wizję wokół celu stawiajcie minutę przed spawnem.",
  },
  {
    key: "controlWards",
    label: "Control wardy drużyny",
    better: "higher",
    scale: 3,
    fmt: (v) => num(v),
    get: (c) => [c.us.reduce((a, p) => a + p.controlWards, 0), c.them.reduce((a, p) => a + p.controlWards, 0)],
    tip: "Za mało control wardów w drużynie — to najtańsza przewaga w grze. Niech każdy ma jeden w ekwipunku.",
  },
];

/* ─── Agregacja ─── */

type Acc = { mine: number; theirs: number; n: number };
const acc = (): Acc => ({ mine: 0, theirs: 0, n: 0 });

function insightFrom(
  def: { key: string; label: string; better: "higher" | "lower"; scale: number; fmt?: (v: number) => string; diff?: boolean; unit?: string },
  a: Acc,
  versus: string,
  tip: string
): Insight | null {
  if (!a.n) return null;
  const mine = a.mine / a.n;
  const theirs = a.theirs / a.n;
  const gap = ((mine - theirs) * (def.better === "higher" ? 1 : -1)) / def.scale;
  const fmt = def.fmt ?? ((v: number) => num(v, a.n > 1 ? 1 : 0));
  // dopełniacz: „z 1 gry”, „z 3 gier”
  const avg = a.n > 1 ? ` (średnio z ${a.n} gier)` : "";
  const detail = def.diff
    ? `${signed(mine - theirs)} ${def.unit ?? ""} względem ${versus}${avg}`
    : `${fmt(mine)} vs ${fmt(theirs)} u ${versus}${avg}`;
  return { key: def.key, title: def.label, detail, tip, severity: Math.round(gap * 100) / 100 };
}

const THRESHOLD = 0.3;
const split = (list: (Insight | null)[], weak: number, strong: number) => {
  const all = list.filter((x): x is Insight => !!x);
  return {
    weaknesses: all.filter((i) => i.severity <= -THRESHOLD).sort((a, b) => a.severity - b.severity).slice(0, weak),
    strengths: all.filter((i) => i.severity >= THRESHOLD).sort((a, b) => b.severity - a.severity).slice(0, strong),
  };
};

// Fazy gry do wskazania, kiedy tracimy złoto
const PHASES = [0, 10, 15, 20, 25, 30, 35];
const PHASE_TIP: Record<number, string> = {
  0: "To faza linii — pracujcie nad farmą, wymianami i bezpieczeństwem przed gankami.",
  10: "To czas pierwszych rotacji i Heralda — jungler z midem powinni decydować, gdzie grać, a reszta trzymać fale.",
  15: "Po upadku pierwszych wież gra się otwiera — zbierajcie się pod smoki, zamiast farmić osobno.",
  20: "Środek gry: walki o smoki i Barona. Grajcie razem, wizja przed celem, bez samotnych wypadów na boczne linie.",
  25: "Późna gra: każdy zgon kosztuje cel albo inhibitor. Mniej ryzyka, więcej gry wokół Barona i Starszego Smoka.",
  30: "Bardzo późna gra: jeden zły ruch przegrywa mecz — trzymajcie się razem i nie łapcie się na bocznych liniach.",
};

/* ─── Analiza ─── */

export function analyzeMatches(matches: DetailMatch[], club: Map<string, string>, lineup: string[]): AnalysisResult {
  const inLineup = new Set(lineup);
  const ctxs: Ctx[] = [];
  for (const m of matches) {
    if (m.remake || m.gameMode !== "CLASSIC") continue;
    const ours = m.players.filter((p) => inLineup.has(club.get(p.puuid) ?? ""));
    if (!ours.length) continue;
    // „Nasza” drużyna — ta, w której grało więcej osób z wybranego składu
    const count = (team: number) => ours.filter((p) => p.teamId === team).length;
    const teamId = count(100) >= count(200) ? 100 : 200;
    ctxs.push({
      m,
      ours: teamId,
      us: m.players.filter((p) => p.teamId === teamId),
      them: m.players.filter((p) => p.teamId !== teamId),
      minutes: Math.max(1, m.duration / 60),
    });
  }

  // Drużyna
  const teamAcc = new Map(TEAM_METRICS.map((d) => [d.key, acc()]));
  const curve = new Map<number, { sum: number; n: number }>();
  const phaseDelta = new Map<number, { sum: number; n: number }>();
  let throws = 0;
  let comebacks = 0;
  const laneGold = new Map<string, Acc>();
  for (const c of ctxs) {
    for (const d of TEAM_METRICS) {
      const v = d.get(c);
      if (!v) continue;
      const a = teamAcc.get(d.key)!;
      a.mine += v[0];
      a.theirs += v[1];
      a.n++;
    }
    let maxLead = 0;
    let maxDeficit = 0;
    for (let minute = 0; minute < c.m.frames.length; minute++) {
      const diff = teamGoldAt(c, c.us, minute)! - teamGoldAt(c, c.them, minute)!;
      const cur = curve.get(minute) ?? { sum: 0, n: 0 };
      curve.set(minute, { sum: cur.sum + diff, n: cur.n + 1 });
      maxLead = Math.max(maxLead, diff);
      maxDeficit = Math.min(maxDeficit, diff);
    }
    const win = c.us[0].win;
    if (maxLead >= 2500 && !win) throws++;
    if (maxDeficit <= -2500 && win) comebacks++;
    for (let i = 0; i < PHASES.length - 1; i++) {
      const [a, b] = [PHASES[i], PHASES[i + 1]];
      if (c.m.frames.length <= b) break;
      const d = teamGoldAt(c, c.us, b)! - teamGoldAt(c, c.them, b)! - (teamGoldAt(c, c.us, a)! - teamGoldAt(c, c.them, a)!);
      const cur = phaseDelta.get(a) ?? { sum: 0, n: 0 };
      phaseDelta.set(a, { sum: cur.sum + d, n: cur.n + 1 });
    }
    for (const p of c.us) {
      const r = rivalOf(c, p);
      if (!r || !club.has(p.puuid) || !inLineup.has(club.get(p.puuid)!) || c.m.frames.length <= 15) continue;
      const a = laneGold.get(p.position) ?? acc();
      a.mine += goldAt(c, p, 15)!;
      a.theirs += goldAt(c, r, 15)!;
      a.n++;
      laneGold.set(p.position, a);
    }
  }

  const vsThem = "przeciwników";
  const teamInsights: (Insight | null)[] = TEAM_METRICS.map((d) => insightFrom(d, teamAcc.get(d.key)!, vsThem, d.tip));

  if (ctxs.length) {
    const rate = throws / ctxs.length;
    if (throws > 0)
      teamInsights.push({
        key: "throws",
        title: "Rzucone wygrane",
        detail: `${throws} z ${gier(ctxs.length)}: mieliście 2,5k+ złota przewagi, a mecz przegraliście`,
        tip: "Z przewagą nie gońcie killi w głąb mapy przeciwnika. Grajcie pod cele (Baron, smoki, wieże), trzymajcie się razem i nie dawajcie się złapać na bocznych liniach.",
        severity: -Math.max(0.3, rate / 0.15),
      });
    if (comebacks > 0)
      teamInsights.push({
        key: "comebacks",
        title: "Odrobione przegrane",
        detail: `${comebacks} z ${gier(ctxs.length)}: odrobiliście 2,5k+ złota straty i wygraliście`,
        tip: "Nie poddajecie się — dobrze gracie od tyłu i czekacie na błędy przeciwników.",
        severity: Math.max(0.3, comebacks / ctxs.length / 0.15),
      });
    // Faza, w której średnio najwięcej tracimy (i zyskujemy)
    const phases = [...phaseDelta.entries()]
      .filter(([, v]) => v.n >= Math.max(1, Math.ceil(ctxs.length / 3)))
      .map(([a, v]) => ({ a, b: PHASES[PHASES.indexOf(a) + 1], avg: v.sum / v.n, n: v.n }));
    const worst = phases.sort((x, y) => x.avg - y.avg)[0];
    if (worst && worst.avg < -400)
      teamInsights.push({
        key: "phase",
        title: `Tracicie złoto między ${worst.a}. a ${worst.b}. minutą`,
        detail: `średnio ${signed(worst.avg)} złota przewagi w tym okresie${worst.n > 1 ? ` (${gier(worst.n)})` : ""}`,
        tip: PHASE_TIP[worst.a],
        severity: worst.avg / 1000,
      });
    const best = phases.sort((x, y) => y.avg - x.avg)[0];
    if (best && best.avg > 400)
      teamInsights.push({
        key: "phaseGood",
        title: `Najlepiej gracie między ${best.a}. a ${best.b}. minutą`,
        detail: `średnio ${signed(best.avg)} złota przewagi w tym okresie`,
        tip: "To Wasza mocna faza — wybierajcie championów i plan gry, które ją wykorzystują.",
        severity: best.avg / 1000,
      });
    // Najsłabsza linia w 15. minucie
    const lanes = [...laneGold.entries()].map(([role, a]) => ({ role, avg: (a.mine - a.theirs) / a.n, n: a.n }));
    const weakLane = lanes.sort((x, y) => x.avg - y.avg)[0];
    if (weakLane && weakLane.avg < -300)
      teamInsights.push({
        key: "lane",
        title: `Najsłabsza linia: ${ROLE_LABEL[weakLane.role] ?? weakLane.role}`,
        detail: `${signed(weakLane.avg)} złota względem rywala w 15. minucie${weakLane.n > 1 ? ` (${gier(weakLane.n)})` : ""}`,
        tip: "Jungler niech częściej osłania tę linię (wizja, kontrganki), a gracz na niej wybiera bezpieczniejsze matchupy i gra na przetrwanie fazy linii.",
        severity: weakLane.avg / 800,
      });
  }

  const team = split(teamInsights, 5, 3);
  const objectives = TEAM_METRICS.filter((d) => d.objective)
    .map((d) => {
      const a = teamAcc.get(d.key)!;
      return a.n ? { label: d.label, ours: a.mine / a.n, theirs: a.theirs / a.n } : null;
    })
    .filter((x): x is { label: string; ours: number; theirs: number } => !!x);

  // Gracze
  const players: PlayerReport[] = [];
  for (const username of lineup) {
    const perMetric = new Map(PLAYER_METRICS.map((d) => [d.key, acc()]));
    const roles = new Map<string, number>();
    const champs = new Map<string, number>();
    let games = 0;
    for (const c of ctxs) {
      const p = c.m.players.find((x) => club.get(x.puuid) === username);
      if (!p) continue;
      const r = rivalOf(c, p);
      if (!r) continue;
      games++;
      roles.set(p.position, (roles.get(p.position) ?? 0) + 1);
      champs.set(p.champion, (champs.get(p.champion) ?? 0) + 1);
      const cp: Ctx = p.teamId === c.ours ? c : { ...c, ours: p.teamId, us: c.them, them: c.us };
      for (const d of PLAYER_METRICS) {
        const v = d.get(cp, p, r);
        if (!v || v.some((x) => x === undefined || Number.isNaN(x))) continue;
        const a = perMetric.get(d.key)!;
        a.mine += v[0];
        a.theirs += v[1];
        a.n++;
      }
    }
    if (!games) continue;
    const mainRole = [...roles.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const list = PLAYER_METRICS.map((d) => insightFrom(d, perMetric.get(d.key)!, "rywala z linii", d.tip(mainRole)));
    players.push({
      username,
      games,
      roles: [...roles.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => ROLE_LABEL[r] ?? r),
      champions: [...champs.entries()].sort((a, b) => b[1] - a[1]).map(([ch]) => ch),
      ...split(list, 4, 3),
    });
  }

  const goldCurve = [...curve.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([minute, v]) => ({ minute, diff: Math.round(v.sum / v.n), n: v.n }))
    // Końcówka z pojedynczych długich meczów przy zakresie tylko zaciemnia wykres
    .filter((pt) => ctxs.length === 1 || pt.n >= Math.max(1, Math.ceil(ctxs.length / 3)));

  const wins = ctxs.filter((c) => c.us[0].win).length;
  return {
    games: ctxs.length,
    wins,
    avgMinutes: ctxs.length ? ctxs.reduce((a, c) => a + c.minutes, 0) / ctxs.length : 0,
    team: { ...team, objectives, goldCurve },
    players,
    single: ctxs.length === 1 ? { id: ctxs[0].m.id, win: wins === 1, minutes: ctxs[0].minutes, moments: moments(ctxs[0], club) } : null,
  };
}

/* ─── Kluczowe momenty jednego meczu ─── */

function moments(c: Ctx, club: Map<string, string>): Moment[] {
  const out: Moment[] = [];
  const name = (p?: DetailPlayer) => {
    if (!p) return "?";
    const u = club.get(p.puuid);
    return u ? `${displayNameOf(u)} (${p.champion})` : p.champion;
  };
  const ourSide = (team: number) => team === c.ours;

  const ks = kills(c);
  const fb = ks[0];
  if (fb) {
    const victim = c.m.players[fb.victim - 1];
    const killer = c.m.players[fb.killer - 1];
    out.push({
      t: fb.t,
      text: `Pierwsza krew: ${name(killer)} zabija ${name(victim)}`,
      tone: victim && ourSide(victim.teamId) ? "bad" : "good",
    });
  }

  // Grubsy biją się grupą — kilka zabitych w ciągu minuty to jeden moment
  const grouped: (Extract<DetailEvent, { k: "monster" }> & { count: number })[] = [];
  for (const o of monsters(c)) {
    const last = grouped[grouped.length - 1];
    if (o.type === "HORDE" && last?.type === "HORDE" && last.team === o.team && o.t - last.t <= MIN) {
      last.count++;
      last.t = o.t;
    } else grouped.push({ ...o, count: 1 });
  }
  for (const o of grouped) {
    const what =
      o.type === "DRAGON"
        ? DRAGON_LABEL[o.sub ?? ""] ?? "smoka"
        : o.type === "HORDE" && o.count > 1
        ? `${o.count} ${o.count < 5 ? "Grubsy" : "Grubsów"}`
        : MONSTER_LABEL[o.type] ?? o.type;
    const mine = ourSide(o.team);
    const deadBefore = ks.filter((k) => {
      const v = c.m.players[k.victim - 1];
      return v && v.teamId !== o.team && k.t <= o.t && o.t - k.t <= MIN;
    });
    let text = `${mine ? "Zdobywacie" : "Przeciwnicy zdobywają"} ${what}`;
    if (!mine && deadBefore.length) {
      const names = deadBefore.map((k) => name(c.m.players[k.victim - 1])).join(", ");
      text += ` — chwilę wcześniej zginęli: ${names}`;
    }
    out.push({ t: o.t, text, tone: mine ? "good" : "bad" });
  }

  const buildings = c.m.events.filter((e): e is Extract<DetailEvent, { k: "building" }> => e.k === "building");
  const firstTower = (lostBy: number) => buildings.find((b) => b.type === "TOWER_BUILDING" && b.lost === lostBy);
  const ourFirst = firstTower(c.them[0].teamId);
  const theirFirst = firstTower(c.ours);
  if (ourFirst) out.push({ t: ourFirst.t, text: "Zabieracie pierwszą wieżę przeciwnika", tone: "good" });
  if (theirFirst) out.push({ t: theirFirst.t, text: "Tracicie pierwszą wieżę", tone: "bad" });
  for (const b of buildings.filter((b) => b.type === "INHIBITOR_BUILDING")) {
    const lostByUs = ourSide(b.lost);
    out.push({ t: b.t, text: lostByUs ? "Tracicie inhibitor" : "Niszczycie inhibitor przeciwnika", tone: lostByUs ? "bad" : "good" });
  }

  // Największe zmiany przewagi złota w oknach 3-minutowych
  const diffAt = (minute: number) => teamGoldAt(c, c.us, minute)! - teamGoldAt(c, c.them, minute)!;
  const swings: { a: number; d: number }[] = [];
  for (let a = 0; a + 3 < c.m.frames.length; a++) swings.push({ a, d: diffAt(a + 3) - diffAt(a) });
  const picked: { a: number; d: number }[] = [];
  for (const s of [...swings].sort((x, y) => Math.abs(y.d) - Math.abs(x.d))) {
    if (Math.abs(s.d) < 1500 || picked.length >= 3) break;
    if (picked.some((p) => Math.abs(p.a - s.a) < 3)) continue;
    picked.push(s);
  }
  for (const s of picked) {
    const deaths = ks.filter(
      (k) => k.t >= s.a * MIN && k.t < (s.a + 3) * MIN && c.m.players[k.victim - 1]?.teamId === c.ours
    ).length;
    out.push({
      t: s.a * MIN,
      text:
        s.d < 0
          ? `Między ${s.a}. a ${s.a + 3}. minutą tracicie ${num(-s.d / 1000)}k złota przewagi${deaths ? ` (${deaths} zgonów)` : ""}`
          : `Między ${s.a}. a ${s.a + 3}. minutą zyskujecie ${num(s.d / 1000)}k złota przewagi`,
      tone: s.d < 0 ? "bad" : "good",
    });
  }

  return out.sort((a, b) => a.t - b.t).map((m) => ({ ...m, t: Math.round(m.t / 1000) }));
}
