// Makiety ekranów Ligi (mecze ekipy w League of Legends) — fikcyjni gracze, generyczne ikony bohaterów.
import { Fragment } from "react";
import { Check, Crown, Microscope, Sparkles, Swords, TrendingDown, TrendingUp, Minus, Users } from "lucide-react";
import { MOCK_USERS, MockAvatar, type MockUser } from "./mock";
import { MiniNav } from "./screens";

const [ania, bartek, kasia, tomek, ola] = MOCK_USERS;

/* ─── Wspólne ──────────────────────────────────────────────────────────────── */

// Kolor komórki wg winrate: 0% cegła → 50% neutralnie → 100% sukno (tokeny motywu, działa w obu motywach)
export function heat(p: number) {
  const t = Math.min(Math.abs(p - 50) * 2, 100) * 0.75;
  const accent = p >= 50 ? "rgb(var(--c-felt))" : "rgb(var(--c-danger))";
  return `color-mix(in srgb, ${accent} ${t}%, rgb(var(--c-panel2)))`;
}

const CHAMPS = [
  { name: "Łowczyni", hue: "#6E8FBF" },
  { name: "Kowal Run", hue: "#B0804A" },
  { name: "Mag Burzy", hue: "#8466B0" },
  { name: "Ostrze Cienia", hue: "#7A4A5E" },
  { name: "Strażnik", hue: "#5E8A6A" },
  { name: "Wiedźma", hue: "#A65B7A" },
  { name: "Pustynny Wilk", hue: "#B59A52" },
  { name: "Lodowa Pani", hue: "#5F9DB0" },
];

function Champ({ i, size = 22, level }: { i: number; size?: number; level?: number }) {
  const c = CHAMPS[i % CHAMPS.length];
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className="inline-flex items-center justify-center rounded-md font-display font-bold text-white/90"
        style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(140deg, ${c.hue}, color-mix(in srgb, ${c.hue} 45%, #000))` }}
        aria-hidden
      >
        {c.name[0]}
      </span>
      {level && (
        <span className="absolute -bottom-1 -right-1 rounded bg-ink px-0.5 font-mono text-[7px] leading-tight text-muted">{level}</span>
      )}
    </span>
  );
}

function Pill({ on, children }: { on?: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${on ? "border-felt/50 bg-felt-soft text-felt" : "border-line text-muted"}`}>
      {on && <Check size={8} />}
      {children}
    </span>
  );
}

const SUB = ["Role", "Progres", "Kontry i linie", "Nawyki", "Analiza meczów"] as const;

function LigaShell({ tab, sub, children }: { tab: "Mecze" | "Wykresy" | "Analityka" | "Ranking Harnasia"; sub?: (typeof SUB)[number]; children: React.ReactNode }) {
  return (
    <div className="text-left">
      <MiniNav active="Liga" />
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 font-display text-lg font-extrabold"><Swords size={16} className="text-felt" /> Liga</p>
            <p className="text-[10px] text-muted">Gry ekipy w League of Legends — wspólne mecze pokazane razem</p>
          </div>
          <div className="flex flex-wrap gap-1">
            <Pill on>30 dni</Pill>
            <Pill on>Flex</Pill>
            <Pill on>Solo/Duo</Pill>
            <Pill>ARAM</Pill>
          </div>
        </div>
        <div className="flex gap-0.5 rounded-lg border border-line bg-surface/60 p-0.5 text-[10px] font-semibold">
          {(["Mecze", "Wykresy", "Analityka", "Ranking Harnasia"] as const).map((t) => (
            <span key={t} className={`flex-1 rounded-md px-2 py-1 text-center ${t === tab ? "bg-panel2 text-cream" : "text-muted"}`}>{t}</span>
          ))}
        </div>
        {sub && (
          <div className="flex flex-wrap gap-1 text-[9px] font-semibold">
            {SUB.map((s) => (
              <span key={s} className={`rounded-full px-2 py-0.5 ${s === sub ? "bg-gold-soft text-gold" : "text-muted"}`}>{s}</span>
            ))}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function Card({ title, sub, children, className = "" }: { title?: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-panel p-3 ${className}`}>
      {title && <p className="text-[11px] font-bold">{title}</p>}
      {sub && <p className="mb-2 text-[9px] text-muted">{sub}</p>}
      {children}
    </div>
  );
}

/* ─── Mecze ────────────────────────────────────────────────────────────────── */

const CARDS = [
  { u: ania, w: 18, l: 11, kda: "6.2/4.1/8.0", crowns: 4, c: 0 },
  { u: bartek, w: 15, l: 13, kda: "4.8/5.0/9.6", crowns: 2, c: 4 },
  { u: kasia, w: 21, l: 9, kda: "8.1/3.7/6.2", crowns: 7, c: 3 },
  { u: tomek, w: 12, l: 14, kda: "3.9/4.6/7.1", crowns: 1, c: 1 },
  { u: ola, w: 14, l: 10, kda: "2.4/3.9/14.3", crowns: 3, c: 5 },
];

export function LigaMatchesScreen() {
  const rows = [
    { u: kasia, c: 3, role: "Mid", k: "11 / 2 / 7", kda: "9.00", cs: "241 CS (7.5/min)", kp: "64%", dmg: "31.2k", score: 78.4, harnas: true },
    { u: ania, c: 0, role: "ADC", k: "8 / 4 / 9", kda: "4.25", cs: "228 CS (7.1/min)", kp: "61%", dmg: "27.9k", score: 63.1 },
    { u: ola, c: 5, role: "Support", k: "1 / 5 / 19", kda: "4.00", cs: "38 CS (1.2/min)", kp: "71%", dmg: "9.4k", score: 58.7 },
  ];
  return (
    <LigaShell tab="Mecze">
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {CARDS.map((p, i) => (
          <div key={p.u.name} className={`rounded-lg border border-line bg-panel p-2 ${i > 2 ? "hidden sm:block" : ""}`}>
            <div className="flex items-center gap-1.5">
              <MockAvatar user={p.u} size={18} ring={false} />
              <span className="min-w-0 flex-1 truncate text-[10px] font-semibold">{p.u.name}</span>
              <Champ i={p.c} size={14} />
            </div>
            <p className="mt-1.5 font-mono text-sm font-bold"><span className="text-felt">{p.w}</span>–<span className="text-danger">{p.l}</span></p>
            <p className="text-[8px] text-muted">{Math.round((p.w / (p.w + p.l)) * 100)}% winrate</p>
            <p className="mt-1 flex items-center gap-1 text-[8px] text-gold"><Crown size={8} /> {p.crowns}× Harnaś</p>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="flex items-center gap-2 border-b border-line/60 bg-surface/50 px-3 py-1.5 text-[9px] text-muted">
          <b className="text-cream">Ranked Flex</b> · 32:15 · wczoraj 21:40
          <span className="ml-auto flex items-center gap-1 rounded-full border border-line px-1.5 py-0.5"><Users size={8} /> premade 3 os.</span>
          <span className="flex items-center gap-1 rounded-full border border-felt/40 px-1.5 py-0.5 text-felt"><Microscope size={8} /> Analizuj</span>
        </div>
        {rows.map((r) => (
          <div key={r.u.name} className={`relative flex items-center gap-2.5 border-t border-line/40 py-2 pl-3 pr-3 first:border-0 ${r.harnas ? "bg-gold-soft/40" : ""}`}>
            <span className="absolute inset-y-0 left-0 w-[3px] bg-felt" />
            <div className="w-16 shrink-0">
              <p className={`flex items-center gap-1 truncate text-[10px] font-bold ${r.harnas ? "text-gold" : ""}`}>{r.u.name}{r.harnas && " 🍺"}</p>
              <p className="text-[8px] text-felt">Zwycięstwo</p>
            </div>
            <Champ i={r.c} size={26} level={16} />
            <div className="hidden w-16 shrink-0 sm:block">
              <p className="truncate text-[9px] font-semibold">{CHAMPS[r.c].name}</p>
              <p className="text-[8px] text-muted">{r.role}</p>
            </div>
            <div className="w-20 shrink-0 whitespace-nowrap text-center">
              <p className="font-mono text-[11px] font-bold">{r.k}</p>
              <p className="text-[8px] text-muted">KDA {r.kda}</p>
            </div>
            <div className="hidden min-w-0 flex-1 space-y-0.5 text-[8px] text-muted md:block">
              <p>{r.cs}</p>
              <p>{r.kp} udział w killach</p>
              <p>{r.dmg} obrażeń</p>
            </div>
            <div className="hidden gap-0.5 lg:flex" aria-hidden>
              {[0, 1, 2, 3, 4, 5].map((k) => (
                <span key={k} className="h-3.5 w-3.5 rounded-sm bg-panel3" />
              ))}
            </div>
            <div className="ml-auto text-right">
              {r.harnas && <span className="mb-0.5 flex items-center gap-0.5 rounded-full bg-gold/20 px-1.5 text-[8px] font-bold text-gold"><Crown size={8} /> Harnaś</span>}
              <p className="text-[8px] text-muted">Score</p>
              <p className="font-mono text-[11px] font-bold">{r.score}</p>
            </div>
          </div>
        ))}
      </div>
    </LigaShell>
  );
}

/* ─── Wykresy ──────────────────────────────────────────────────────────────── */

export function LigaChartsScreen() {
  const hours = ["19–20", "20–21", "21–22", "22–23", "23–00", "00–01", "01–19"];
  const data: [string, number[]][] = [
    ["Gry ekipy", [58, 62, 55, 49, 41, 33, 45]],
    [ania.name, [61, 66, 57, 52, 44, 30, 50]],
    [kasia.name, [70, 64, 63, 58, 47, 40, 52]],
    [tomek.name, [44, 52, 47, 41, 36, 25, 38]],
  ];
  const bars = [[3, 1], [2, 2], [4, 1], [0, 0], [1, 3], [5, 2], [3, 3], [2, 0], [4, 2], [1, 1], [3, 4], [6, 1], [2, 1], [4, 3]];
  return (
    <LigaShell tab="Wykresy">
      <Card title="Winrate wg pory dnia" sub="Godzina rozpoczęcia gry (czas polski) · 19:00–01:00 co godzinę">
        <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] gap-0.5 text-center text-[8px]">
          <span />
          {hours.map((h) => <span key={h} className="font-mono text-muted">{h}</span>)}
          {data.map(([name, vals]) => (
            <Row key={name} name={name} vals={vals} />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-1.5 text-[8px] text-muted">
          0% <span className="h-1.5 w-16 rounded-full" style={{ background: `linear-gradient(90deg, ${heat(0)}, ${heat(50)}, ${heat(100)})` }} /> 100% winrate
        </div>
      </Card>
      <Card title="Gry dzień po dniu" sub="Gry wybranych graczy — wspólna gra liczy się raz">
        <div className="flex h-24 items-end gap-1">
          {bars.map(([w, l], i) => (
            <div key={i} className="flex flex-1 flex-col-reverse">
              <span className="rounded-b-sm bg-felt/80" style={{ height: w * 11 }} />
              <span className="rounded-t-sm bg-danger/70" style={{ height: l * 11 }} />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[8px] text-muted">
          <span>22.09</span><span>28.09</span><span>05.10</span>
        </div>
        <div className="mt-1 flex gap-3 text-[8px] text-muted">
          <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-sm bg-felt" /> Wygrane</span>
          <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-sm bg-danger" /> Porażki</span>
        </div>
      </Card>
    </LigaShell>
  );
}

function Row({ name, vals }: { name: string; vals: number[] }) {
  return (
    <>
      <span className="truncate pr-1 text-left text-[9px] font-semibold leading-6">{name}</span>
      {vals.map((v, i) => (
        <span key={i} className="rounded py-1 font-mono text-[9px] font-bold" style={{ background: heat(v) }}>
          {v}%
        </span>
      ))}
    </>
  );
}

/* ─── Analityka: Role ──────────────────────────────────────────────────────── */

export function LigaRolesScreen() {
  const roles = [
    { role: "TOP", u: tomek, games: "19 gier · 11–8", wr: 58, conf: "średnia", c: [1, 4] },
    { role: "JUNGLE", u: bartek, games: "23 gry · 14–9", wr: 61, conf: "wysoka", c: [4, 6] },
    { role: "MID", u: kasia, games: "27 gier · 18–9", wr: 66, conf: "wysoka", c: [3, 2] },
    { role: "ADC", u: ania, games: "21 gier · 12–9", wr: 57, conf: "wysoka", c: [0, 7] },
    { role: "SUPPORT", u: ola, games: "16 gier · 9–7", wr: 56, conf: "średnia", c: [5, 7] },
  ];
  const matrix: [MockUser, number[]][] = [
    [ania, [44, 38, 52, 57, 49]],
    [bartek, [50, 61, 41, 46, 53]],
    [kasia, [55, 47, 66, 51, 40]],
    [tomek, [58, 43, 45, 39, 47]],
    [ola, [36, 49, 42, 50, 56]],
  ];
  return (
    <LigaShell tab="Analityka" sub="Role">
      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-bold"><Sparkles size={11} className="text-gold" /> Rekomendowany podział ról <span className="font-normal text-muted">· kto na roli najczęściej wygrywa</span></p>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
          {roles.map((r, i) => (
            <div key={r.role} className={`rounded-xl border border-line bg-panel p-2 ${i === 4 ? "hidden sm:block" : ""}`}>
              <p className="text-[8px] font-bold tracking-wider text-muted">{r.role}</p>
              <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold"><MockAvatar user={r.u} size={16} ring={false} /> {r.u.name}</p>
              <p className="text-[8px] text-muted">na tej roli: {r.games}</p>
              <p className="mt-1 font-display text-xl font-extrabold text-felt">{r.wr}%</p>
              <p className="text-[7px] uppercase tracking-wider text-muted">szacowany winrate · {r.conf} pewność</p>
              <div className="mt-1.5 space-y-0.5">
                {r.c.map((c, k) => (
                  <p key={c} className="flex items-center gap-1 text-[8px]"><Champ i={c} size={12} /> <span className="flex-1 truncate">{CHAMPS[c].name}</span> <span className="font-mono text-muted">{64 - k * 7}%</span></p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Card title="Gracze na rolach">
        <div className="grid grid-cols-[56px_repeat(5,minmax(0,1fr))] gap-0.5 text-center text-[8px]">
          <span />
          {["Top", "Jungle", "Mid", "ADC", "Support"].map((r) => <span key={r} className="text-muted">{r}</span>)}
          {matrix.map(([u, vals], ui) => (
            <Fragment key={u.name}>
              <span className="truncate text-left text-[9px] font-semibold leading-5">{u.name}</span>
              {vals.map((v, i) => {
                const best = roles[i].u === u;
                return (
                  <span key={`${ui}-${i}`} className={`rounded py-0.5 font-mono text-[9px] font-bold ${best ? "outline outline-1 outline-cream/80" : ""}`} style={{ background: heat(v) }}>
                    {v}%
                  </span>
                );
              })}
            </Fragment>
          ))}
        </div>
      </Card>
    </LigaShell>
  );
}

/* ─── Analityka: Progres ───────────────────────────────────────────────────── */

function Spark({ pts, up }: { pts: number[]; up: boolean | null }) {
  const avg = pts.map((_, i) => {
    const w = pts.slice(Math.max(0, i - 4), i + 1);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
  const x = (i: number) => 4 + (i * 292) / (pts.length - 1);
  const y = (v: number) => 34 - ((v - 20) / 70) * 30;
  const color = up === null ? "rgb(var(--c-muted))" : up ? "rgb(var(--c-felt))" : "rgb(var(--c-danger))";
  return (
    <svg viewBox="0 0 300 38" className="mt-1 h-10 w-full" aria-hidden>
      <line x1="0" x2="300" y1={y(50)} y2={y(50)} stroke="rgb(var(--c-line))" strokeDasharray="3 3" />
      {pts.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="1.6" fill="rgb(var(--c-muted))" fillOpacity="0.6" />)}
      <polyline points={avg.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function LigaProgressScreen() {
  const players = [
    {
      u: kasia,
      rows: [
        { role: "Mid", d: "+5.2", up: true, g: "12 → 15 gier", s: "score 48.1 → 53.3 · winrate 45% → 60%", m: "KDA: 2.10 → 3.05", pts: [40, 52, 38, 47, 55, 44, 58, 61, 49, 63, 57, 66, 59, 70] },
        { role: "Top", d: "+1.0", up: null, g: "4 → 5 gier", s: "score 50.2 → 51.2 · winrate 50% → 60%", m: "CS/min: 6.4 → 6.9", pts: [52, 47, 55, 49, 51, 54, 48, 53, 50] },
      ],
    },
    {
      u: tomek,
      rows: [
        { role: "Top", d: "−4.8", up: false, g: "10 → 9 gier", s: "score 54.0 → 49.2 · winrate 60% → 44%", m: "Zgony: 4.1 → 6.3", pts: [60, 55, 62, 51, 57, 48, 52, 45, 50, 41, 47, 43] },
        { role: "Jungle", d: "+3.6", up: true, g: "3 → 6 gier", s: "score 45.5 → 49.1 · winrate 33% → 50%", m: "Udział w killach: 52% → 63%", pts: [38, 44, 41, 49, 46, 53, 51, 55] },
      ],
    },
  ];
  return (
    <LigaShell tab="Analityka" sub="Progres">
      <p className="text-[10px] text-muted">Progres na rolach · 06.09.2026 – 05.10.2026 (30 dni)</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {players.map((p) => (
          <Card key={p.u.name}>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold"><MockAvatar user={p.u} size={18} ring={false} /> {p.u.name}</p>
            <div className="space-y-2">
              {p.rows.map((r) => {
                const Icon = r.up === null ? Minus : r.up ? TrendingUp : TrendingDown;
                return (
                  <div key={r.role} className="rounded-lg bg-panel2/60 p-2">
                    <div className="flex items-center gap-2 text-[9px]">
                      <b>{r.role}</b>
                      <span className={`flex items-center gap-0.5 font-semibold ${r.up === null ? "text-muted" : r.up ? "text-felt" : "text-danger"}`}>
                        <Icon size={10} /> {r.up === null ? "stabilnie" : r.up ? "progres" : "regres"} {r.d}
                      </span>
                      <span className="ml-auto text-muted">{r.g}</span>
                    </div>
                    <p className="mt-0.5 text-[8px] text-muted">{r.s}</p>
                    <p className="text-[8px] text-muted">najbardziej zmieniło się: <span className="text-cream">{r.m}</span></p>
                    <Spark pts={r.pts} up={r.up} />
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </LigaShell>
  );
}

/* ─── Analityka: Kontry i linie ────────────────────────────────────────────── */

function ChampTable({ title, sub, rows }: { title: string; sub?: string; rows: [number, number, string, number][] }) {
  return (
    <Card title={title} sub={sub}>
      <div className="grid grid-cols-[minmax(0,1fr)_36px_36px_40px] gap-y-1 text-[9px]">
        <span className="text-[8px] text-muted">Champion</span><span className="text-[8px] text-muted">score</span><span className="text-[8px] text-muted">W–P</span><span className="text-right text-[8px] text-muted">winrate</span>
        {rows.map(([c, s, wl, wr]) => (
          <Fragment key={c}>
            <span className="flex items-center gap-1 truncate"><Champ i={c} size={14} /> {CHAMPS[c].name}</span>
            <span className="font-mono">{s}</span>
            <span className="font-mono text-muted">{wl}</span>
            <span className="rounded text-right font-mono font-bold" style={{ background: heat(wr) }}>{wr}%&nbsp;</span>
          </Fragment>
        ))}
      </div>
    </Card>
  );
}

export function LigaCountersScreen() {
  const lanes = [
    { r: "Top", wr: 52, wl: "26–24", s: "51.2", kda: "5.1/4.3/7.2" },
    { r: "Jungle", wr: 55, wl: "22–18", s: "52.8", kda: "6.0/4.8/9.1" },
    { r: "Mid", wr: 61, wl: "30–19", s: "55.4", kda: "7.4/3.9/7.7" },
    { r: "ADC", wr: 41, wl: "17–24", s: "46.3", kda: "5.2/5.6/6.8", worst: true },
    { r: "Support", wr: 54, wl: "21–18", s: "50.9", kda: "1.9/4.4/13.6" },
  ];
  return (
    <LigaShell tab="Analityka" sub="Kontry i linie">
      <div className="flex flex-wrap items-center gap-1 text-[9px]">
        <span className="text-muted">Dla kogo:</span>
        <Pill on>Cały skład</Pill>
        {MOCK_USERS.slice(0, 4).map((u) => <Pill key={u.name}>{u.name}</Pill>)}
      </div>
      <Card title="Na której linii idzie najgorzej">
        <div className="grid grid-cols-5 gap-1.5">
          {lanes.map((l) => (
            <div key={l.r} className={`rounded-lg border p-1.5 text-center ${l.worst ? "border-danger/50 bg-danger/10" : "border-line bg-panel2/50"}`}>
              <p className="text-[8px] font-bold uppercase text-muted">{l.r}</p>
              <p className={`font-display text-base font-extrabold ${l.worst ? "text-danger" : ""}`}>{l.wr}%</p>
              <p className="text-[7px] text-muted">{l.wl} · score {l.s}</p>
              <p className="hidden text-[7px] text-muted sm:block">KDA {l.kda}</p>
              {l.worst && <p className="mt-0.5 text-[7px] font-bold uppercase text-danger">najsłabsza</p>}
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-2 sm:grid-cols-2">
        <ChampTable title="Najtrudniejsi rywale na linii" rows={[[2, 41.2, "2–7", 22], [6, 44.8, "3–6", 33], [7, 46.1, "4–6", 40]]} />
        <ChampTable title="Najlepsze własne picki" rows={[[3, 63.5, "12–3", 80], [0, 58.9, "9–4", 69], [4, 55.2, "7–4", 64]]} />
      </div>
    </LigaShell>
  );
}

/* ─── Analityka: Nawyki ────────────────────────────────────────────────────── */

function Bars({ title, bars }: { title: string; bars: [string, number, string][] }) {
  return (
    <Card title={title}>
      <div className="flex h-20 items-end gap-1.5">
        {bars.map(([label, wr]) => (
          <div key={label} className="flex h-full flex-1 flex-col items-center justify-end gap-0.5">
            <span className="font-mono text-[8px] font-bold">{wr}%</span>
            <span className="w-full rounded-t" style={{ height: `${wr * 0.8}%`, background: heat(wr) }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {bars.map(([label, , wl]) => (
          <div key={label} className="flex-1 text-center leading-tight">
            <p className="text-[7px] font-semibold">{label}</p>
            <p className="font-mono text-[7px] text-muted">{wl}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function LigaHabitsScreen() {
  return (
    <LigaShell tab="Analityka" sub="Nawyki">
      <div className="rounded-xl border border-gold/40 bg-gold-soft/40 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gold">Wnioski</p>
        <ul className="mt-1 space-y-0.5 text-[9px] text-cream/90">
          <li>• Po 3. grze w sesji winrate spada z 55% do 41% — zmęczenie robi swoje.</li>
          <li>• Po dwóch porażkach z rzędu wygrywacie tylko 35% gier. Przerwa na herbatę?</li>
          <li>• Najlepszy duet: Kasia + Ola (+9 pp względem średniej).</li>
        </ul>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Bars title="Która gra wieczoru" bars={[["1. gra", 57, "24–18"], ["2. gra", 55, "21–17"], ["3. gra", 49, "17–18"], ["4. gra", 41, "9–13"], ["5.+", 36, "5–9"]]} />
        <Bars title="Tilt" bars={[["po wygranej", 58, "38–28"], ["po porażce", 46, "25–29"], ["po 2+ porażkach", 35, "7–13"]]} />
        <Bars title="Długość meczu" bars={[["< 25 min", 62, "18–11"], ["25–30", 54, "26–22"], ["30–35", 50, "19–19"], ["35–40", 44, "11–14"], ["40+", 38, "5–8"]]} />
        <Card title="Duety">
          <div className="space-y-1.5">
            {([[kasia, ola, "16–6", 73, "+9"], [ania, bartek, "14–9", 61, "+4"], [tomek, ania, "8–10", 44, "−6"]] as const).map(([a, b, wl, wr, syn]) => (
              <div key={a.name + b.name} className="flex items-center gap-1.5 text-[9px]">
                <span className="flex -space-x-1.5"><MockAvatar user={a} size={16} /><MockAvatar user={b} size={16} /></span>
                <span className="flex-1 truncate font-semibold">{a.name} + {b.name}</span>
                <span className="font-mono text-muted">{wl}</span>
                <span className="rounded-full px-1.5 font-mono font-bold" style={{ background: heat(wr) }}>{wr}%</span>
                <span className={`w-7 text-right font-mono ${syn.startsWith("+") ? "text-felt" : "text-danger"}`}>{syn} pp</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </LigaShell>
  );
}

/* ─── Analityka: Analiza meczów ────────────────────────────────────────────── */

export function LigaDeepScreen() {
  const gold = [0, 120, -80, 340, 610, 420, 980, 1350, 900, 1700, 2600, 2200, 3100];
  const x = (i: number) => (i * 300) / (gold.length - 1);
  const y = (v: number) => 45 - (v / 3500) * 38;
  const line = gold.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <LigaShell tab="Analityka" sub="Analiza meczów">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel p-2.5">
        <p className="flex items-center gap-1 text-[11px] font-bold"><Microscope size={12} className="text-felt" /> Co poszło najgorzej</p>
        <div className="flex gap-1">
          {["Ostatnie 5", "10", "20", "30"].map((z, i) => <Pill key={z} on={i === 1}>{z}</Pill>)}
        </div>
        <span className="ml-auto rounded-lg bg-felt px-2 py-1 text-[9px] font-bold text-onaccent">Analizuj 10 meczów</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {[["10", "przeanalizowanych meczów"], ["6–4", "bilans"], ["31:42", "średnia długość"]].map(([v, l]) => (
          <div key={l} className="rounded-lg border border-line bg-panel p-1.5">
            <p className="font-display text-base font-extrabold">{v}</p>
            <p className="text-[7px] uppercase tracking-wider text-muted">{l}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        <Card title="Przewaga złota w czasie" className="sm:col-span-3">
          <svg viewBox="0 0 300 70" className="w-full" aria-hidden>
            <line x1="0" x2="300" y1={y(0)} y2={y(0)} stroke="rgb(var(--c-line))" />
            <polygon points={`0,${y(0)} ${line} 300,${y(0)}`} fill="rgb(var(--c-felt) / 0.25)" />
            <polyline points={line} fill="none" stroke="rgb(var(--c-felt))" strokeWidth="1.8" />
            <rect x={x(1.6)} y={y(0)} width="14" height="3" fill="rgb(var(--c-danger) / 0.5)" />
            {[0, 5, 10, 15, 20, 25, 30].map((m, i) => (
              <text key={m} x={i * 48 + 2} y="66" fontSize="7" fill="rgb(var(--c-muted))" fontFamily="monospace">{m}&apos;</text>
            ))}
          </svg>
        </Card>
        <Card title="Cele (średnio na mecz)" className="sm:col-span-2">
          <div className="grid grid-cols-[minmax(0,1fr)_28px_28px] gap-y-0.5 text-[9px]">
            <span /><span className="text-center text-[8px] text-felt">My</span><span className="text-center text-[8px] text-danger">Oni</span>
            {[["Smoki", "2.4", "1.9"], ["Barony", "0.8", "0.5"], ["Wieże", "6.1", "4.7"], ["Pierwsza krew", "40%", "60%"]].map(([n, a, b]) => (
              <Fragment key={n}>
                <span className="text-muted">{n}</span>
                <span className="text-center font-mono font-bold">{a}</span>
                <span className="text-center font-mono">{b}</span>
              </Fragment>
            ))}
          </div>
        </Card>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-2">
          <p className="text-[9px] font-bold text-danger">Zgony przed 14. minutą</p>
          <p className="text-[8px] text-cream/80">Średnio 3,2 zgonu na mecz na bocznych liniach — rywal zyskuje przewagę na start.</p>
        </div>
        <div className="rounded-lg border border-felt/40 bg-felt-soft/50 p-2">
          <p className="text-[9px] font-bold text-felt">Mocne strony: cele neutralne</p>
          <p className="text-[8px] text-cream/80">Pierwszy smok w 7 z 10 meczów, świetna kontrola wizji.</p>
        </div>
      </div>
    </LigaShell>
  );
}

/* ─── Ranking Harnasia ─────────────────────────────────────────────────────── */

export function LigaHarnasScreen() {
  const podium = [
    { u: ania, n: 6, place: 2, rec: "81.2" },
    { u: kasia, n: 9, place: 1, rec: "87.3" },
    { u: ola, n: 4, place: 3, rec: "76.8" },
  ];
  const table = [
    [kasia, 9, 21, "43%", "61.8", "87.3"],
    [ania, 6, 22, "27%", "56.4", "81.2"],
    [ola, 4, 19, "21%", "54.0", "76.8"],
    [bartek, 2, 20, "10%", "49.7", "72.5"],
  ] as const;
  return (
    <LigaShell tab="Ranking Harnasia">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/40 bg-gold-soft/30 p-2.5">
        <p className="flex items-center gap-1 text-[11px] font-bold text-gold"><Crown size={12} /> Ranking Harnasia 🍺</p>
        <p className="hidden flex-1 text-[8px] text-muted sm:block">Harnasia dostaje najlepszy z ekipy w meczu, w którym grało nas co najmniej 3.</p>
        <span className="ml-auto rounded-md border border-line bg-surface px-2 py-0.5 text-[9px]">Październik 2026</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-lg border border-line bg-panel p-1.5"><p className="font-display text-base font-extrabold">21</p><p className="text-[7px] uppercase tracking-wider text-muted">ocenione mecze</p></div>
        <div className="rounded-lg border border-line bg-panel p-1.5"><p className="font-display text-base font-extrabold text-gold">9× Kasia</p><p className="text-[7px] uppercase tracking-wider text-muted">lider miesiąca</p></div>
        <div className="rounded-lg border border-line bg-panel p-1.5"><p className="font-display text-base font-extrabold">87.3</p><p className="text-[7px] uppercase tracking-wider text-muted">rekord · {CHAMPS[3].name}</p></div>
      </div>
      <div className="flex items-end justify-center gap-2">
        {podium.map((p) => (
          <div key={p.u.name} className={`flex w-24 flex-col items-center rounded-t-xl border border-b-0 px-2 pt-2 ${p.place === 1 ? "h-28 border-gold/50 bg-gold-soft/40" : p.place === 2 ? "h-24 border-line bg-panel" : "h-20 border-line bg-panel"}`}>
            <span className="relative">
              <MockAvatar user={p.u} size={p.place === 1 ? 34 : 26} />
              {p.place === 1 && <span className="absolute -right-2 -top-2 text-xs">🍺</span>}
            </span>
            <p className="mt-1 text-[10px] font-bold">{p.u.name}</p>
            <p className={`font-display text-sm font-extrabold ${p.place === 1 ? "text-gold" : ""}`}>{p.n}×</p>
            <p className="text-[7px] text-muted">{p.place === 1 ? "Harnaś miesiąca" : `${p.place}. miejsce · rekord ${p.rec}`}</p>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-panel text-[9px]">
        <div className="grid grid-cols-[16px_minmax(0,1fr)_40px_36px_44px_40px] gap-1 border-b border-line/60 px-2.5 py-1 text-[8px] text-muted">
          <span>#</span><span>Gracz</span><span>Harnaś</span><span>Mecze</span><span>% meczów</span><span>Śr. score</span>
        </div>
        {table.map(([u, h, m, pct, avg], i) => (
          <div key={u.name} className="grid grid-cols-[16px_minmax(0,1fr)_40px_36px_44px_40px] items-center gap-1 border-t border-line/40 px-2.5 py-1 first:border-0">
            <span className={`font-mono font-bold ${i === 0 ? "text-gold" : "text-muted"}`}>{i + 1}</span>
            <span className="flex items-center gap-1 font-semibold"><MockAvatar user={u} size={14} ring={false} /> {u.name}</span>
            <span className="flex items-center gap-0.5 font-mono text-gold"><Crown size={8} />{h}</span>
            <span className="font-mono">{m}</span>
            <span className="font-mono text-muted">{pct}</span>
            <span className="font-mono">{avg}</span>
          </div>
        ))}
      </div>
    </LigaShell>
  );
}
