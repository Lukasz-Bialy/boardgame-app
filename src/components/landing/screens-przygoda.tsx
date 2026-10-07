// Makiety modułu Przygoda (D&D przez posty z AI jako Mistrzem Gry) — fikcyjne postacie i generyczne grafiki SVG.
// Klasy .font-tale, .drop-cap, .portrait-frame, .round-divider, .roll-request, .dice-table, .ability-medal
// pochodzą z globals.css i są te same co w prawdziwej zakładce.
import {
  Backpack,
  Compass,
  Crosshair,
  Dices,
  EyeOff,
  Feather,
  Hourglass,
  MapPin,
  Play,
  Plus,
  ScrollText,
  Send,
  Shield,
  HeartPulse,
  Skull,
  Sparkles,
  Sword,
  Swords,
  Users,
  WandSparkles,
  Sun,
  Music,
  Flame,
  Leaf,
  Axe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MOCK_USERS, MockAvatar } from "./mock";
import { MiniNav } from "./screens";

const [ania, bartek, kasia, tomek] = MOCK_USERS;
const PARCHMENT = "#F3DFAE";

/* ─── Postacie ─────────────────────────────────────────────────────────────── */

type Hero = { name: string; race: string; cls: string; color: string; icon: LucideIcon; hp: number; max: number; player: (typeof MOCK_USERS)[number] };

const HEROES: Hero[] = [
  { name: "Brana Kamiennoręka", race: "Krasnolud", cls: "Wojowniczka", color: "#C0673E", icon: Sword, hp: 9, max: 12, player: kasia },
  { name: "Lyra Srebrnoliść", race: "Elf", cls: "Łowczyni", color: "#5C8A4E", icon: Crosshair, hp: 10, max: 10, player: ania },
  { name: "Fink Podkowa", race: "Niziołek", cls: "Łotrzyk", color: "#6B6FA8", icon: EyeOff, hp: 7, max: 9, player: bartek },
  { name: "Ozryk z Wieży", race: "Człowiek", cls: "Czarodziej", color: "#4A78B8", icon: WandSparkles, hp: 0, max: 7, player: tomek },
];
const [brana, lyra, fink, ozryk] = HEROES;

function Portrait({ hero, w, h, rounded = "rounded-lg" }: { hero: Hero; w: number; h: number; rounded?: string }) {
  const Icon = hero.icon;
  return (
    <span className={`portrait-frame inline-block shrink-0 ${rounded}`} style={{ width: w, height: h }}>
      <span
        className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden ${rounded}`}
        style={{ background: `radial-gradient(circle at 50% 35%, ${hero.color}, #1a130e 75%)` }}
      >
        <Icon size={Math.min(w, h) * 0.32} className="text-white/25" />
        <b className="font-tale absolute leading-none" style={{ color: PARCHMENT, fontSize: Math.min(w, h) * 0.42 }}>
          {hero.name[0]}
        </b>
        {h > 60 && (
          <span className="absolute bottom-1 text-[7px] uppercase tracking-widest" style={{ color: `${PARCHMENT}aa` }}>
            {hero.race}
          </span>
        )}
      </span>
    </span>
  );
}

/* ─── Grafiki zastępcze (jak art.tsx w aplikacji) ──────────────────────────── */

const PALETTES = [
  ["#2a1c2f", "#6b3a3a", "#d08a4f"],
  ["#10202b", "#284a55", "#b2a57a"],
  ["#161b2e", "#3b3f6b", "#a37bb0"],
  ["#1b1410", "#4b3322", "#c79a55"],
];

function Scene({ p = 0, className = "", tower = false }: { p?: number; className?: string; tower?: boolean }) {
  const [sky, mid, glow] = PALETTES[p];
  const id = `scene-${p}`;
  return (
    <svg viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky} />
          <stop offset="1" stopColor={mid} />
        </linearGradient>
      </defs>
      <rect width="320" height="120" fill={`url(#${id})`} />
      <circle cx="232" cy="58" r="20" fill={glow} fillOpacity=".85" />
      <path d="M0 84 L40 62 L78 76 L120 52 L168 74 L214 56 L262 72 L320 58 V120 H0 Z" fill={mid} fillOpacity=".9" />
      <path d="M0 98 L52 80 L96 92 L150 76 L204 94 L256 82 L320 92 V120 H0 Z" fill="#000" fillOpacity=".35" />
      {tower && <path d="M150 104 V70 h8 v-6 h5 v6 h6 v-6 h5 v6 h8 V104 Z" fill="#0b0806" />}
      {tower && <rect x="161" y="80" width="6" height="9" fill={glow} />}
      <path d="M0 108 Q80 96 160 104 T320 100 V120 H0 Z" fill="#0b0806" />
    </svg>
  );
}

function MapArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id="adv-map" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#efe0bd" />
          <stop offset="1" stopColor="#c9a86e" />
        </linearGradient>
      </defs>
      <rect width="160" height="120" fill="url(#adv-map)" />
      <path d="M22 60 C20 30 60 18 92 24 C128 30 146 52 136 80 C126 104 80 108 54 98 C34 90 24 80 22 60 Z" fill="#e3cf9f" stroke="#5a3d22" strokeWidth="1.2" />
      {[[58, 46], [70, 40], [64, 54]].map(([x, y]) => (
        <path key={`${x}${y}`} d={`M${x - 7} ${y + 6} L${x} ${y - 6} L${x + 7} ${y + 6} Z`} fill="#d8c08a" stroke="#5a3d22" strokeWidth=".8" />
      ))}
      {[[100, 70], [108, 76], [96, 80], [112, 64]].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r="3.4" fill="#6f7f4a" />
      ))}
      <path d="M40 78 C56 70 66 76 80 66 S104 52 118 44" fill="none" stroke="#8e2a24" strokeWidth="1.4" strokeDasharray="3 3" />
      <path d="M115 41 l6 6 M121 41 l-6 6" stroke="#8e2a24" strokeWidth="1.6" />
      <g transform="translate(140 22)" stroke="#5a3d22" strokeWidth=".8">
        <circle r="9" fill="none" />
        <path d="M0 -12 L2.5 0 L0 12 L-2.5 0 Z" fill="#5a3d22" />
      </g>
    </svg>
  );
}

function D20({ size = 28, value, color = "#8E2A24" }: { size?: number; value?: number; color?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
      <path d="M20 2 L37 11 V29 L20 38 L3 29 V11 Z" fill={color} stroke={PARCHMENT} strokeOpacity=".5" strokeWidth="1" />
      <path d="M20 2 L20 14 M3 11 L20 14 L37 11 M20 14 L10 31 M20 14 L30 31 M10 31 H30" stroke={PARCHMENT} strokeOpacity=".25" fill="none" />
      {value != null && (
        <text x="20" y="27" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="800" fontSize="13" fill={PARCHMENT}>
          {value}
        </text>
      )}
    </svg>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-left">
      <MiniNav active="Przygoda" />
      <div className="space-y-3 p-4 sm:p-5">{children}</div>
    </div>
  );
}

function CampaignHeader() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <p className="font-tale text-2xl font-semibold leading-tight">Klątwa Czarnego Młyna</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="rounded-full bg-gold-soft px-2 py-0.5 font-semibold text-gold">Mroczne fantasy</span>
          <span className="rounded-full bg-felt-soft px-2 py-0.5 font-semibold text-felt">Runda 4</span>
          <span className="flex items-center gap-1 text-muted"><MapPin size={10} /> Ruiny młyna nad Czarną Strugą</span>
        </div>
      </div>
    </div>
  );
}

/* ─── 1. Kampanie ──────────────────────────────────────────────────────────── */

export function AdvCampaignsScreen() {
  const cards = [
    { t: "Klątwa Czarnego Młyna", tone: "Mroczne fantasy", loc: "Ruiny młyna", status: "Runda 4", st: "felt", p: 0, heroes: [brana, lyra, fink, ozryk], ago: "2 h temu", tower: true },
    { t: "Latarnia, która zgasła", tone: "Z przymrużeniem oka", loc: "Klif Mewiego Dzioba", status: "Zbieranie drużyny", st: "gold", p: 1, heroes: [lyra, fink], ago: "wczoraj" },
    { t: "Sen, który nie przychodzi", tone: "Horror", loc: "Miasteczko Dolne Wierzby", status: "Zakończona", st: "parch", p: 2, heroes: [brana, ozryk, lyra], ago: "3 tyg. temu" },
  ];
  return (
    <Shell>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="font-display text-lg font-extrabold">Przygoda</p>
          <p className="text-[10px] text-muted">Gra fabularna w stylu D&amp;D z AI jako Mistrzem Gry · każdy gra, kiedy ma czas</p>
        </div>
        <span className="flex items-center gap-1 rounded-lg bg-felt px-2.5 py-1 text-[10px] font-bold text-onaccent"><Plus size={11} /> Nowa przygoda</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {cards.map((c, i) => (
          <div key={c.t} className={`overflow-hidden rounded-xl border border-line bg-panel ${i === 2 ? "hidden sm:block" : ""}`}>
            <div className="relative">
              <Scene p={c.p} tower={c.tower} className="aspect-video w-full" />
              <span
                className={`absolute left-1.5 top-1.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[8px] font-bold backdrop-blur ${c.st === "felt" ? "text-felt" : c.st === "gold" ? "text-gold" : ""}`}
                style={c.st === "parch" ? { color: PARCHMENT } : undefined}
              >
                {c.status}
              </span>
            </div>
            <div className="p-2.5">
              <p className="font-tale truncate text-base font-semibold leading-tight">{c.t}</p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-[9px]">
                <span className="text-gold">{c.tone}</span>
                <span className="flex items-center gap-0.5 text-muted"><MapPin size={8} />{c.loc}</span>
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className="flex -space-x-1.5">
                  {c.heroes.map((h) => <Portrait key={h.name} hero={h} w={20} h={20} rounded="rounded-full" />)}
                </span>
                <span className="text-[8px] text-muted">{c.ago}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          [Users, "Stwórz postać", "Rasa i klasa — liczby dobiorą się same."],
          [Feather, "Mistrz Gry opisuje", "AI prowadzi opowieść i gra wszystkich NPC."],
          [ScrollText, "Deklarujesz działanie", "Piszesz, kiedy masz czas. Nie trzeba naraz."],
          [Dices, "Kości rozstrzygają", "k20 + premia ≥ trudność = sukces."],
        ].map(([Icon, t, d], i) => {
          const I = Icon as LucideIcon;
          return (
            <div key={t as string} className="rounded-lg border border-line bg-panel2/40 p-2">
              <span className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold-soft text-gold"><I size={10} /></span>
                <b className="font-tale text-[12px]">{i + 1}. {t as string}</b>
              </span>
              <p className="mt-1 text-[8px] leading-snug text-muted">{d as string}</p>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/* ─── 2. Nowa przygoda ─────────────────────────────────────────────────────── */

export function AdvNewCampaignScreen() {
  const tones = [
    ["Klasyczne fantasy", "heroiczna przygoda, lochy, smoki, karczmy"],
    ["Mroczne fantasy", "ponury świat, trudne wybory, groza w tle"],
    ["Z przymrużeniem oka", "humor, absurdalne sytuacje, barwni NPC"],
    ["Horror", "napięcie, niewyjaśnione zjawiska, strach"],
    ["Kryminał / intryga", "śledztwo, spiski, dworskie intrygi"],
  ];
  return (
    <Shell>
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-panel p-4">
        <p className="font-display text-base font-extrabold">Nowa przygoda</p>
        <p className="mt-3 text-[9px] font-semibold uppercase tracking-widest text-muted">Tytuł</p>
        <div className="mt-1 rounded-lg border border-line bg-surface/80 px-2.5 py-1.5 text-[11px]">Klątwa Czarnego Młyna</div>
        <p className="mt-3 text-[9px] font-semibold uppercase tracking-widest text-muted">Klimat</p>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {tones.map(([n, h], i) => (
            <div key={n} className={`rounded-lg border p-2 ${i === 1 ? "border-gold/70 bg-gold/10" : "border-line"}`}>
              <p className="font-tale text-[12px] font-semibold">{n}</p>
              <p className="text-[8px] text-muted">{h}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-center justify-between text-[9px] font-semibold uppercase tracking-widest text-muted">
          Pomysł na start (opcjonalnie) <span className="normal-case tracking-normal text-felt">losuj</span>
        </p>
        <div className="font-tale mt-1 rounded-lg border border-line bg-surface/80 px-2.5 py-1.5 text-[12px] leading-snug">
          Karawana kupiecka zaginęła na przełęczy, a jedyny ocalały woźnica powtarza w kółko jedno słowo: „dzwony”.
        </div>
        <span className="mt-3 block rounded-lg bg-felt py-1.5 text-center text-[11px] font-bold text-onaccent">Utwórz i zbierz drużynę</span>
      </div>
    </Shell>
  );
}

/* ─── 3. Kreator postaci ───────────────────────────────────────────────────── */

const CLASSES: [string, LucideIcon, string][] = [
  ["Wojownik", Sword, "#C0673E"],
  ["Barbarzyńca", Axe, "#B04A3A"],
  ["Łotrzyk", EyeOff, "#6B6FA8"],
  ["Łowca", Crosshair, "#5C8A4E"],
  ["Czarodziej", WandSparkles, "#4A78B8"],
  ["Kapłan", Sun, "#D6AA62"],
  ["Paladyn", Shield, "#C9A64A"],
  ["Bard", Music, "#B0629E"],
  ["Czarnoksiężnik", Flame, "#7A4FA8"],
  ["Druid", Leaf, "#4E8E6A"],
];

const ABILITIES: [string, string, number, string][] = [
  ["SIŁ", "Siła", 10, "+0"],
  ["ZRE", "Zręczność", 17, "+3"],
  ["KON", "Kondycja", 13, "+1"],
  ["INT", "Inteligencja", 13, "+1"],
  ["MDR", "Mądrość", 14, "+2"],
  ["CHA", "Charyzma", 8, "−1"],
];

export function AdvCreatorScreen() {
  const races = [
    ["Człowiek", "+1 do każdej cechy"],
    ["Elf", "ZRE +2 · INT +1"],
    ["Krasnolud", "KON +2 · MDR +1"],
    ["Niziołek", "ZRE +2 · CHA +1"],
    ["Tiefling", "CHA +2 · INT +1"],
    ["Drakonid", "SIŁ +2 · CHA +1"],
  ];
  return (
    <Shell>
      <div className="rounded-lg border border-gold/30 bg-gold/[0.07] p-2 text-[9px] leading-snug text-cream/90">
        Postać to Twój bohater w opowieści. <b>Rasa</b> daje premie do cech, <b>klasa</b> określa, w czym jest dobra. Liczby możesz zostawić domyślne.
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
        <div className="space-y-2.5">
          <div>
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-muted">Rasa</p>
            <div className="grid grid-cols-3 gap-1">
              {races.map(([n, b], i) => (
                <div key={n} className={`rounded-md border px-1.5 py-1 ${i === 1 ? "border-gold/70 bg-gold/10" : "border-line"}`}>
                  <p className="font-tale text-[11px] font-semibold leading-tight">{n}</p>
                  <p className="text-[7px] text-gold">{b}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-muted">Klasa</p>
            <div className="grid grid-cols-5 gap-1">
              {CLASSES.map(([n, Icon, c]) => {
                const on = n === "Łowca";
                return (
                  <div key={n} className="flex flex-col items-center gap-0.5 rounded-md border px-1 py-1" style={{ borderColor: on ? c : "rgb(var(--c-line))", boxShadow: on ? `inset 0 0 0 1px ${c}` : undefined }}>
                    <span className="flex h-5 w-5 items-center justify-center rounded" style={{ background: `${c}26`, color: c }}><Icon size={11} /></span>
                    <span className="font-tale w-full truncate text-center text-[9px] leading-tight">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-muted">Cechy <span className="normal-case tracking-normal">(zestaw 15 · 14 · 13 · 12 · 10 · 8 + premia rasy)</span></p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {ABILITIES.map(([abbr, name, score, mod]) => (
                <div key={abbr} className="flex items-center gap-1.5 text-[9px]">
                  <span className="w-16 font-semibold">{name}</span>
                  <span className="rounded border border-line px-1 font-mono text-muted">{abbr}</span>
                  <span className="ml-auto font-mono font-bold">{score}</span>
                  <span className="w-5 text-right font-mono text-gold">{mod}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-2 rounded-xl border border-line bg-panel2/40 p-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted">Podgląd</p>
          <div className="flex justify-center"><Portrait hero={lyra} w={64} h={80} /></div>
          <p className="font-tale text-center text-sm font-semibold leading-tight">Lyra Srebrnoliść</p>
          <div className="grid grid-cols-2 gap-1 text-center">
            <div className="rounded-lg bg-panel p-1"><HeartPulse size={10} className="mx-auto text-felt" /><b className="font-mono text-xs">11</b><p className="text-[7px] text-muted">Punkty życia</p></div>
            <div className="rounded-lg bg-panel p-1"><Shield size={10} className="mx-auto text-gold" /><b className="font-mono text-xs">14</b><p className="text-[7px] text-muted">Klasa pancerza</p></div>
          </div>
          <div className="flex flex-wrap gap-0.5">
            {["Percepcja", "Skradanie", "Sztuka przetrwania"].map((s) => (
              <span key={s} className="rounded-full bg-panel px-1.5 text-[7px]">{s}</span>
            ))}
          </div>
          <p className="text-[7px] leading-snug text-muted">Start: Długi łuk (1k8, 20 strzał), Skórzana zbroja, 2 krótkie miecze (1k6)</p>
        </div>
      </div>
    </Shell>
  );
}

/* ─── 4. Opowieść ──────────────────────────────────────────────────────────── */

function PartyRow({ hero, status }: { hero: Hero; status: "done" | "wait" | "roll" | "down" }) {
  const pct = (hero.hp / hero.max) * 100;
  return (
    <div className={`flex items-center gap-2 ${status === "down" ? "grayscale" : ""}`}>
      <Portrait hero={hero} w={26} h={30} rounded="rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1">
          <span className="font-tale truncate text-[11px] font-semibold">{hero.name.split(" ")[0]}</span>
          {status === "done" && <i className="h-1.5 w-1.5 rounded-full bg-felt" />}
          {status === "wait" && <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />}
          {status === "roll" && <span className="text-[7px] font-bold text-gold">rzut!</span>}
        </p>
        {status === "down" ? (
          <p className="text-[7px] font-bold uppercase tracking-wider text-danger">Umiera · ●○○</p>
        ) : (
          <div className="mt-0.5 flex items-center gap-1">
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-panel3">
              <span className={`block h-full rounded-full ${pct > 50 ? "bg-felt" : pct > 25 ? "bg-gold" : "bg-danger"}`} style={{ width: `${pct}%` }} />
            </span>
            <span className="font-mono text-[7px] text-muted">{hero.hp}/{hero.max}</span>
          </div>
        )}
      </div>
      <MockAvatar user={hero.player} size={14} ring={false} />
    </div>
  );
}

export function AdvStoryScreen() {
  return (
    <Shell>
      <CampaignHeader />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
        <div className="min-w-0 space-y-2">
          <p className="round-divider !pt-0 !text-[9px]">Runda 4</p>
          <div className="overflow-hidden rounded-xl border border-line bg-panel">
            <Scene p={0} tower className="aspect-[16/6] w-full" />
            <div className="p-3">
              <p className="flex items-center gap-1.5 text-[8px]">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gold-soft text-gold"><Feather size={9} /></span>
                <b className="uppercase tracking-widest text-gold">Mistrz Gry</b>
                <span className="text-muted">· 5 min temu</span>
              </p>
              <div className="drop-cap font-tale mt-1.5 text-[12.5px] leading-snug text-cream/95">
                <p>
                  Koło młyna obraca się, choć Czarna Struga od lat jest wyschnięta. Z wnętrza dobiega skrzypienie żaren i ciche,
                  rytmiczne bicie <b>dzwonu</b>. Brana pierwsza dostrzega na progu świeży ślad mąki, jakby ktoś przed chwilą wyszedł.
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 border-t border-line/60 pt-2 text-[8px]">
                <span className="rounded-full bg-felt-soft px-1.5 py-0.5 text-felt">Lyra: +50 PD</span>
                <span className="rounded-full bg-felt-soft px-1.5 py-0.5 text-felt">Fink: Zdobywa: Srebrny klucz</span>
                <span className="rounded-full bg-danger/15 px-1.5 py-0.5 text-danger">Brana: −3 PW (1k6)</span>
              </div>
            </div>
          </div>
          <div className="ml-4 flex items-start gap-2">
            <Portrait hero={fink} w={22} h={26} rounded="rounded-md" />
            <div className="flex-1 rounded-xl rounded-tl-sm border border-line bg-panel px-2.5 py-1.5" style={{ borderLeft: `3px solid ${fink.color}` }}>
              <p className="text-[8px] text-muted"><b className="font-tale text-[11px] text-cream">Fink Podkowa</b> (Bartek) · 3 min temu</p>
              <p className="font-tale text-[12px] leading-snug">Skradam się wzdłuż muru i zaglądam przez szparę w okiennicy.</p>
            </div>
          </div>
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-[9px]">
            <D20 size={18} value={14} />
            <b className="font-tale text-[11px]">Fink</b> Skradanie (ZRE)
            <span className="font-mono text-muted">14 +5 = 19 vs ST 15</span>
            <span className="rounded-full bg-felt-soft px-1.5 font-bold uppercase text-felt">sukces</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-panel2/40 px-2.5 py-1.5 text-[9px] text-muted">
            <Hourglass size={10} className="text-gold" /> Czekamy na: <b className="text-cream">Lyra</b> · Mistrz Gry rozstrzygnie sam za ~17 h
            <span className="ml-auto flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-cream"><Play size={8} /> Popchnij fabułę</span>
          </div>
        </div>
        <div className="hidden space-y-2 sm:block">
          <div className="relative overflow-hidden rounded-xl border border-line">
            <MapArt className="aspect-[4/3] w-full" />
            <span className="font-tale absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-4 text-[11px]" style={{ color: PARCHMENT }}>
              <Compass size={10} /> Ruiny młyna
            </span>
          </div>
          <div className="space-y-1.5 rounded-xl border border-line bg-panel p-2">
            <p className="text-[8px] font-semibold uppercase tracking-widest text-muted">Drużyna</p>
            <PartyRow hero={brana} status="done" />
            <PartyRow hero={lyra} status="wait" />
            <PartyRow hero={fink} status="done" />
            <PartyRow hero={ozryk} status="down" />
          </div>
        </div>
      </div>
    </Shell>
  );
}

/* ─── 5. Rzut kością ───────────────────────────────────────────────────────── */

export function AdvRollScreen() {
  const dice: [string, string, string][] = [
    ["k4", "#3F7A5A", "M20 4 L36 34 H4 Z"],
    ["k6", "#35507A", "M6 6 H34 V34 H6 Z"],
    ["k8", "#6B3F7A", "M20 3 L36 20 L20 37 L4 20 Z"],
    ["k10", "#7A5A2E", "M20 3 L35 16 L20 37 L5 16 Z"],
    ["k12", "#2F6B6B", "M20 3 L36 15 L30 35 H10 L4 15 Z"],
    ["k20", "#8E2A24", "M20 2 L37 11 V29 L20 38 L3 29 V11 Z"],
  ];
  return (
    <Shell>
      <CampaignHeader />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2.5">
          <div className="roll-request rounded-xl border bg-panel p-3">
            <div className="flex items-start gap-2.5">
              <D20 size={34} />
              <div className="min-w-0 flex-1">
                <p className="text-[8px] font-bold uppercase tracking-widest text-gold">Mistrz Gry prosi o rzut</p>
                <p className="font-tale text-sm font-semibold">Percepcja (MDR) <span className="text-muted">· ST 13</span></p>
                <p className="text-[10px] leading-snug text-cream/85">Czy Lyra dostrzeże, kto porusza się na strychu młyna?</p>
                <p className="mt-1 font-mono text-[9px] text-muted">k20 +4</p>
              </div>
            </div>
            <span className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg bg-felt py-1.5 text-[11px] font-bold text-onaccent"><Dices size={12} /> Rzuć k20</span>
          </div>
          <div className="rounded-xl border border-line bg-panel p-2.5">
            <p className="mb-1.5 text-[8px] font-semibold uppercase tracking-widest text-muted">Rzut swobodny</p>
            <div className="grid grid-cols-6 gap-1">
              {dice.map(([n, c, d]) => (
                <span key={n} className="flex flex-col items-center gap-0.5 rounded-md border border-line py-1">
                  <svg viewBox="0 0 40 40" width="18" height="18" aria-hidden>
                    <path d={d} fill={c} stroke={PARCHMENT} strokeOpacity=".5" />
                  </svg>
                  <span className="font-mono text-[8px]">{n}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="dice-table relative flex flex-col items-center justify-center overflow-hidden rounded-3xl px-4 py-5 text-center">
          <div aria-hidden className="absolute left-1/2 top-[38%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(214,170,98,0.45),transparent_65%)]" />
          <p className="label relative !mb-0 !text-[8px]">Percepcja (MDR)</p>
          <p className="font-tale relative text-sm font-semibold">Lyra Srebrnoliść</p>
          <div className="relative my-3">
            <div className="dice-spin"><D20 size={92} value={20} /></div>
            <span className="absolute -bottom-2 left-1/2 h-2 w-20 -translate-x-1/2 rounded-full bg-black/40 blur-sm" />
          </div>
          <p className="font-tale relative text-lg font-semibold text-gold">Naturalna dwudziestka!</p>
          <p className="relative font-mono text-[10px] text-cream">k20 = 20 +4 = <b>24</b> · ST 13</p>
          <span className="relative mt-2 rounded-full bg-felt/25 px-4 py-1 text-[11px] font-bold text-[#cfe9d6] ring-1 ring-felt/60">Sukces</span>
        </div>
      </div>
    </Shell>
  );
}

/* ─── 6. Karta postaci ─────────────────────────────────────────────────────── */

export function AdvSheetScreen() {
  const skills: [string, string, string, boolean][] = [
    ["Akrobatyka", "ZRE", "+3", false],
    ["Percepcja", "MDR", "+4", true],
    ["Skradanie", "ZRE", "+5", true],
    ["Sztuka przetrwania", "MDR", "+4", true],
    ["Atletyka", "SIŁ", "+0", false],
    ["Intuicja", "MDR", "+2", false],
  ];
  return (
    <Shell>
      <div className="grid gap-3 sm:grid-cols-[130px_minmax(0,1fr)]">
        <div className="space-y-2">
          <Portrait hero={lyra} w={130} h={162} rounded="rounded-xl" />
          <div className="grid grid-cols-2 gap-1.5">
            <div className="sheet-badge"><Shield size={11} className="text-gold" /><b className="font-mono text-sm">14</b><span className="text-[7px] text-muted">KP</span></div>
            <div className="sheet-badge"><HeartPulse size={11} className="text-felt" /><b className="font-mono text-sm">10/11</b><span className="text-[7px] text-muted">PW</span></div>
          </div>
          <span className="block h-1 overflow-hidden rounded-full bg-panel3"><span className="block h-full w-[91%] rounded-full bg-felt" /></span>
        </div>
        <div className="min-w-0 space-y-2.5">
          <div>
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-tale text-2xl font-semibold leading-none">Lyra Srebrnoliść</span>
              <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: `${lyra.color}33`, color: "#a9cf9b" }}>
                <Crosshair size={9} /> Łowczyni
              </span>
            </p>
            <p className="mt-1 text-[9px] text-muted">Elf · poziom 2 · biegłość +2 · kość wytrzymałości k10 · gra <b className="text-cream">Ania</b></p>
          </div>
          <div className="grid grid-cols-6 gap-1.5 pb-1">
            {ABILITIES.map(([abbr, , score, mod], i) => (
              <div key={abbr} className="ability-medal !pb-2.5 !pt-1">
                {(i === 0 || i === 1) && <i className="absolute right-1 top-1 h-1 w-1 rounded-full bg-gold" />}
                <span className="text-[7px] font-bold uppercase tracking-wider text-muted">{abbr}</span>
                <b className="font-display text-base leading-tight">{mod}</b>
                <span className="ability-score !text-[8px]">{score}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="flex items-center justify-between text-[8px] font-semibold uppercase tracking-widest text-muted">
              <span className="flex items-center gap-1"><Sparkles size={9} /> Doświadczenie</span>
              <span className="font-mono normal-case tracking-normal">420 / 900 PD</span>
            </p>
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-panel3"><span className="block h-full w-[47%] rounded-full bg-gold" /></span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[8px] font-semibold uppercase tracking-widest text-muted">Umiejętności</p>
              {skills.map(([n, a, m, prof]) => (
                <p key={n} className={`flex items-center gap-1.5 text-[9px] ${prof ? "" : "text-muted"}`}>
                  <i className={`h-1.5 w-1.5 rounded-full ${prof ? "bg-gold" : "border border-muted"}`} />
                  {n} <span className="text-[7px] text-muted">{a}</span>
                  <span className="ml-auto font-mono">{m}</span>
                </p>
              ))}
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1 text-[8px] font-semibold uppercase tracking-widest text-muted"><Backpack size={9} /> Ekwipunek</p>
              <div className="space-y-0.5">
                {["Długi łuk (1k8, 17 strzał)", "Skórzana zbroja", "2 krótkie miecze (1k6)", "Srebrny klucz", "Mikstura leczenia (2k4+2)"].map((it) => (
                  <p key={it} className="rounded border border-line/70 px-1.5 py-0.5 text-[9px]">{it}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/* ─── 7. Walka ─────────────────────────────────────────────────────────────── */

export function AdvCombatScreen() {
  const enemies = [
    { n: "Młynarz-upiór", ac: 13, hp: 7, max: 18, note: "boi się dzwonu" },
    { n: "Szczurołak", ac: 12, hp: 11, max: 11 },
  ];
  return (
    <Shell>
      <CampaignHeader />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
        <div className="min-w-0 space-y-2">
          <div className="rounded-xl border border-line bg-panel p-3">
            <p className="flex items-center gap-1.5 text-[8px]">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gold-soft text-gold"><Feather size={9} /></span>
              <b className="uppercase tracking-widest text-gold">Mistrz Gry</b>
            </p>
            <p className="font-tale mt-1.5 text-[12.5px] leading-snug text-cream/95">
              Upiór wyłania się z mąki jak z mgły. Jego cep świszczy w powietrzu — Ozryk nie zdąża unieść kostura i pada na deski.
            </p>
            <div className="mt-2 flex flex-wrap gap-1 border-t border-line/60 pt-2 text-[8px]">
              <span className="rounded-full bg-danger/15 px-1.5 py-0.5 text-danger">Młynarz-upiór trafia krytycznie Ozryka — obrażenia 2k8 → −9 PW</span>
              <span className="rounded-full bg-felt-soft px-1.5 py-0.5 text-felt">Szczurołak atakuje Branę — pudło</span>
              <span className="rounded-full bg-panel2 px-1.5 py-0.5 text-muted">Ozryk: Stan: Nieprzytomny</span>
            </div>
          </div>
          <div className="roll-request rounded-xl border !border-danger/60 bg-panel p-3">
            <p className="text-[8px] font-bold uppercase tracking-widest text-danger">Twoja postać umiera — walka o życie</p>
            <p className="font-tale text-sm font-semibold">Rzut przeciw śmierci</p>
            <p className="text-[9px] leading-snug text-cream/85">
              Rzuć k20: <b>10 lub więcej</b> to sukces. <b>3 sukcesy</b> — przeżyjesz, <b>3 porażki</b> — śmierć. Naturalna 20 od razu stawia na nogi z 1 PW.
            </p>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[8px] text-muted">
                sukcesy <span className="flex gap-0.5"><i className="h-2 w-2 rounded-full bg-felt" /><i className="h-2 w-2 rounded-full border border-felt/60" /><i className="h-2 w-2 rounded-full border border-felt/60" /></span>
                porażki <span className="flex gap-0.5"><i className="h-2 w-2 rounded-full bg-danger" /><i className="h-2 w-2 rounded-full border border-danger/60" /><i className="h-2 w-2 rounded-full border border-danger/60" /></span>
              </span>
              <span className="flex items-center gap-1 rounded-lg bg-felt px-2.5 py-1 text-[10px] font-bold text-onaccent"><Dices size={11} /> Rzuć k20</span>
            </div>
          </div>
          <div className="rounded-xl border border-line bg-panel p-2.5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold"><Portrait hero={brana} w={18} h={18} rounded="rounded-full" /> Co robi Brana?</p>
            <div className="font-tale mt-1.5 rounded-lg border border-line bg-surface/80 px-2 py-1.5 text-[12px] text-cream/90">
              Staję nad Ozrykiem z toporem i krzyczę do Finka: „Bij w dzwon, teraz!”
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[8px] text-muted">
              Ctrl+Enter wysyła
              <span className="flex items-center gap-1 rounded-md bg-felt px-2 py-0.5 text-[9px] font-bold text-onaccent"><Send size={9} /> Wyślij</span>
            </div>
          </div>
        </div>
        <div className="hidden space-y-2 sm:block">
          <div className="space-y-2 rounded-xl border border-danger/30 bg-panel p-2">
            <p className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-widest text-danger"><Swords size={9} /> Wrogowie</p>
            {enemies.map((e) => (
              <div key={e.n}>
                <p className="flex items-center gap-1 text-[10px] font-semibold"><Skull size={10} className="text-danger" /> {e.n} <span className="ml-auto font-mono text-[8px] text-muted">KP {e.ac}</span></p>
                <div className="mt-0.5 flex items-center gap-1">
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-panel3"><span className="block h-full rounded-full bg-danger" style={{ width: `${(e.hp / e.max) * 100}%` }} /></span>
                  <span className="font-mono text-[7px] text-muted">{e.hp}/{e.max}</span>
                </div>
                {e.note && <p className="text-[8px] italic text-muted">{e.note}</p>}
              </div>
            ))}
          </div>
          <div className="space-y-1.5 rounded-xl border border-line bg-panel p-2">
            <p className="text-[8px] font-semibold uppercase tracking-widest text-muted">Drużyna</p>
            <PartyRow hero={brana} status="wait" />
            <PartyRow hero={lyra} status="done" />
            <PartyRow hero={fink} status="roll" />
            <PartyRow hero={ozryk} status="down" />
          </div>
        </div>
      </div>
    </Shell>
  );
}

