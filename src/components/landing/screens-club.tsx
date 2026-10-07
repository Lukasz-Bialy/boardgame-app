// Makiety pozostałych ekranów klubu (szczegóły gry, historia, kalendarz, wishlista, losowanie, kebab, święta).
import { Fragment } from "react";
import { CalendarDays, Dices, ExternalLink, Gift, Package, Shuffle, Star, Trophy, Vote } from "lucide-react";
import { AvatarStack, GameCover, MOCK_GAMES, MOCK_USERS, MockAvatar } from "./mock";
import { MiniNav, Tile } from "./screens";

const [ania, bartek, kasia, tomek, ola] = MOCK_USERS;

function Place({ n }: { n: number }) {
  const cls = n === 1 ? "bg-gold text-onaccent" : n === 2 ? "bg-cream/70 text-ink" : n === 3 ? "bg-[#B07A4A] text-white" : "bg-panel3 text-muted";
  return <span className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-bold ${cls}`}>{n}</span>;
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <p className="font-display text-lg font-extrabold">{title}</p>
      <p className="text-[10px] text-muted">{sub}</p>
    </div>
  );
}

/* ─── Szczegóły gry ────────────────────────────────────────────────────────── */

export function GameDetailScreen() {
  const g = MOCK_GAMES[0];
  const sessions = [
    { date: "03.10.2026", dur: "52 min", order: [kasia, ania, tomek, bartek], note: "Kasia zamknęła mapę w ostatniej rundzie!" },
    { date: "26.09.2026", dur: "47 min", order: [ania, ola, kasia] },
  ];
  return (
    <div className="text-left">
      <MiniNav active="Kolekcja" />
      <div className="grid gap-4 p-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:p-5">
        <GameCover game={g} className="hidden aspect-square w-full rounded-xl sm:block" />
        <div className="min-w-0">
          <p className="font-display text-xl font-extrabold">{g.name}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Rysujecie mapę wyspy, zbieracie zlecenia i walczycie o najlepsze tereny. Lekka, szybka i bardzo regrywalna.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
            {["1–4 graczy", "45 min", "23 rozegranych", "★ 8.6 (5)"].map((c) => (
              <span key={c} className="rounded-full border border-line bg-panel2 px-2 py-0.5">{c}</span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel p-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Twoja ocena</span>
            <span className="flex gap-0.5 text-gold">
              {Array.from({ length: 10 }, (_, i) => (
                <Star key={i} size={11} className={i < 9 ? "fill-gold" : ""} />
              ))}
            </span>
            <span className="ml-auto flex gap-1">
              {[kasia, tomek, ola].map((u, i) => (
                <span key={u.name} className="flex items-center gap-1 rounded-full bg-panel2 py-0.5 pl-0.5 pr-1.5 text-[9px]">
                  <MockAvatar user={u} size={14} ring={false} /> ★{[9, 8, 8][i]}
                </span>
              ))}
            </span>
          </div>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold">Rozgrywki</p>
            <span className="rounded-lg bg-felt px-2 py-1 text-[10px] font-bold text-onaccent">+ Nowa rozgrywka</span>
          </div>
          {sessions.map((s) => (
            <div key={s.date} className="rounded-xl border border-line bg-panel p-2.5">
              <p className="text-[10px] text-muted">
                <b className="text-cream">{s.date}</b> · {s.dur} · dodała: Ania
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {s.order.map((u, i) => (
                  <span key={u.name} className="flex items-center gap-1 rounded-full border border-line bg-panel2 py-0.5 pl-0.5 pr-2 text-[10px]">
                    <Place n={i + 1} /> <MockAvatar user={u} size={14} ring={false} /> {u.name}
                  </span>
                ))}
              </div>
              {s.note && <p className="mt-1.5 text-[10px] italic text-muted">„{s.note}”</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Moja historia ────────────────────────────────────────────────────────── */

export function HistoryScreen() {
  const perGame = [
    { g: MOCK_GAMES[0], n: 14, p: [6, 4, 2, 2] },
    { g: MOCK_GAMES[5], n: 19, p: [5, 6, 3, 5] },
    { g: MOCK_GAMES[3], n: 8, p: [3, 1, 2, 2] },
    { g: MOCK_GAMES[1], n: 11, p: [2, 4, 3, 2] },
  ];
  const recent = [
    { place: 1, g: MOCK_GAMES[0], n: 4, d: "03.10" },
    { place: 3, g: MOCK_GAMES[3], n: 5, d: "30.09" },
    { place: 2, g: MOCK_GAMES[5], n: 6, d: "26.09" },
  ];
  const cols = "grid-cols-[minmax(0,1fr)_40px_24px_24px_24px_60px]";
  return (
    <div className="text-left">
      <MiniNav active="Historia" />
      <div className="space-y-3 p-4 sm:p-5">
        <Heading title="Moja historia" sub="Twoje partie i statystyki zajmowanych miejsc" />
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Rozegranych partii" value="87" accent="felt" icon={Dices} />
          <Tile label="Zwycięstw" value="24" accent="gold" icon={Trophy} />
          <Tile label="Skuteczność" value="28%" accent="felt" icon={Star} />
        </div>
        <div className="overflow-hidden rounded-xl border border-line bg-panel text-[10px]">
          <p className="border-b border-line/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Miejsca wg gry</p>
          <div className={`grid ${cols} gap-1 px-3 py-1 text-[9px] text-muted`}>
            <span>Gra</span><span>Partie</span><span>🥇</span><span>🥈</span><span>🥉</span><span>poza podium</span>
          </div>
          {perGame.map(({ g, n, p }) => (
            <div key={g.name} className={`grid ${cols} items-center gap-1 border-t border-line/40 px-3 py-1.5 font-mono`}>
              <span className="flex items-center gap-1.5 truncate font-sans font-semibold">
                <GameCover game={g} className="h-5 w-5 shrink-0 rounded" /> {g.name}
              </span>
              <span>{n}</span>
              <span className="text-gold">{p[0]}</span>
              <span>{p[1]}</span>
              <span>{p[2]}</span>
              <span className="text-muted">{p[3]}</span>
            </div>
          ))}
        </div>
        <div className="space-y-1">
          {recent.map((r) => (
            <div key={r.d} className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 text-[10px]">
              <Place n={r.place} />
              <span className="flex-1 font-semibold">{r.g.name}</span>
              <span className="text-muted">z {r.n} graczami</span>
              <span className="font-mono text-muted">{r.d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Kalendarz ────────────────────────────────────────────────────────────── */

export function CalendarScreen() {
  const offset = 3; // październik 2026 zaczyna się w czwartek
  const meetings: Record<number, boolean> = { 2: false, 9: true, 16: false, 23: true, 30: false }; // true = z ankietą
  const today = 5;
  const list = [
    { d: "9", w: "pt", t: "Wieczór z nowościami", n: "u Bartka, 19:00", u: bartek, poll: true },
    { d: "16", w: "pt", t: "Turniej w Blef i Koronę", n: "przekąski we własnym zakresie", u: kasia, poll: false },
    { d: "23", w: "pt", t: "Kosmiczni Kupcy — kampania", n: "start 18:00", u: tomek, poll: true },
  ];
  return (
    <div className="text-left">
      <MiniNav active="Kalendarz" />
      <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] sm:p-5">
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-muted">‹</span>
            <p className="font-display text-sm font-extrabold">Październik 2026</p>
            <span className="text-muted">›</span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[9px]">
            {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((d) => (
              <span key={d} className="pb-1 text-muted">{d}</span>
            ))}
            {Array.from({ length: offset }, (_, i) => <span key={`e${i}`} />)}
            {Array.from({ length: 31 }, (_, i) => {
              const d = i + 1;
              return (
                <span
                  key={d}
                  className={`relative flex aspect-square items-center justify-center rounded-md font-mono ${
                    d in meetings ? "bg-felt-soft font-bold text-felt" : "bg-panel2/50"
                  } ${d === today ? "ring-1 ring-gold" : ""}`}
                >
                  {d}
                  {meetings[d] && <i className="absolute bottom-0.5 h-1 w-1 rounded-full bg-gold" />}
                </span>
              );
            })}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Spotkania · październik</p>
          {list.map((m) => (
            <div key={m.d} className="flex items-start gap-2 rounded-lg border border-line bg-panel p-2">
              <span className="flex w-8 shrink-0 flex-col items-center rounded-md bg-felt-soft py-0.5 text-felt">
                <b className="font-display text-sm leading-none">{m.d}</b>
                <span className="text-[8px] uppercase">{m.w}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-semibold">{m.t}</p>
                <p className="truncate text-[9px] text-muted">{m.n}</p>
                {m.poll && (
                  <p className="mt-0.5 flex items-center gap-1 text-[9px] text-gold">
                    <Vote size={9} /> ankieta: w co gramy?
                  </p>
                )}
              </div>
              <MockAvatar user={m.u} size={16} ring={false} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Wishlista ────────────────────────────────────────────────────────────── */

export function WishlistScreen() {
  const items = [
    { g: { ...MOCK_GAMES[2], name: "Latarnie Północy" }, note: "Kooperacja na 4, idealna na zimę", u: ola, d: "02.10" },
    { g: { ...MOCK_GAMES[4], name: "Gildia Zegarmistrzów" }, note: "Ciężkie euro, dla chętnych", u: tomek, d: "28.09" },
    { g: { ...MOCK_GAMES[1], name: "Pustynne Szlaki" }, note: "Dodatek do Szlaku Karawan", u: ania, d: "21.09" },
  ];
  return (
    <div className="text-left">
      <MiniNav active="Wishlista" />
      <div className="space-y-3 p-4 sm:p-5">
        <Heading title="Wishlista" sub="Gry, które fajnie byłoby kupić · 7 pozycji" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {items.map((it, i) => (
            <div key={it.g.name} className={`overflow-hidden rounded-xl border border-line bg-panel ${i === 2 ? "hidden sm:block" : ""}`}>
              <GameCover game={it.g} className="aspect-[16/10] w-full" />
              <div className="p-2.5">
                <p className="truncate text-xs font-semibold">{it.g.name}</p>
                <p className="mt-0.5 text-[10px] text-muted">{it.note}</p>
                <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-felt">
                  <ExternalLink size={10} /> Zobacz
                </p>
              </div>
              <div className="flex items-center gap-1.5 border-t border-line/60 px-2.5 py-1.5 text-[9px] text-muted">
                <MockAvatar user={it.u} size={14} ring={false} /> {it.u.name} · {it.d}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Losowanie ────────────────────────────────────────────────────────────── */

export function DrawScreen() {
  const roles = [
    { r: "Top", c: "#C9826B", u: tomek },
    { r: "Jungle", c: "#6EAA80", u: bartek },
    { r: "Mid", c: "#A88BC7", u: kasia },
    { r: "Bottom", c: "#D6AA62", u: ania },
    { r: "Support", c: "#7F9CC2", u: ola },
  ];
  return (
    <div className="text-left">
      <MiniNav active="Losowanie" />
      <div className="space-y-3 p-4 sm:p-5">
        <Heading title="Losowanie" sub="Przydziel wartości uczestnikom losowo" />
        <div className="flex items-center gap-2 rounded-xl border border-line bg-panel p-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Uczestnicy</span>
          <span className="flex gap-1.5">
            {MOCK_USERS.map((u) => (
              <span key={u.name} className="inline-flex rounded-full ring-2 ring-felt/70">
                <MockAvatar user={u} size={22} ring={false} />
              </span>
            ))}
          </span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border border-gold/40 bg-gold-soft/40 p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">Pierwszy gracz</p>
            <div className="mx-auto mt-2 w-fit">
              <MockAvatar user={kasia} size={40} />
            </div>
            <p className="mt-1.5 font-display text-base font-extrabold">Kasia</p>
            <p className="text-[10px] text-muted">zaczyna jako pierwsza</p>
          </div>
          <div className="rounded-xl border border-line bg-panel p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Przydział ról</p>
            <div className="mt-2 space-y-1">
              {roles.map(({ r, c, u }) => (
                <div key={r} className="flex items-center gap-2 text-[10px]">
                  <span className="w-14 rounded-full px-2 py-0.5 text-center text-[9px] font-bold text-[#16110c]" style={{ background: c }}>
                    {r}
                  </span>
                  <MockAvatar user={u} size={16} ring={false} />
                  <span className="font-semibold">{u.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-panel p-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Wartości</span>
          {["czerwony", "niebieski", "zielony", "żółty"].map((v) => (
            <span key={v} className="rounded-full bg-panel2 px-2 py-0.5 text-[10px]">{v}</span>
          ))}
          <span className="ml-auto flex items-center gap-1 rounded-lg bg-felt px-2.5 py-1 text-[10px] font-bold text-onaccent">
            <Shuffle size={11} /> Losuj!
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Kącik kebabowy ───────────────────────────────────────────────────────── */

export function KebabScreen() {
  const items = [
    { u: ania, what: "Kebab w bułce, ostry", price: "28,00", stars: 5 },
    { u: bartek, what: "Talerz XL z frytkami", price: "36,00", stars: 4 },
    { u: kasia, what: "Falafel w tortilli", price: "26,00", stars: 5 },
    { u: tomek, what: "Kebab box + ayran", price: "31,00", stars: 3 },
  ];
  return (
    <div className="text-left">
      <MiniNav active="Kebab" />
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-end justify-between gap-2">
          <Heading title="Kącik kebabowy" sub="Zamówienia z dostawą · rozliczenia · oceny" />
          <div className="flex gap-0.5 rounded-lg border border-line bg-surface/60 p-0.5 text-[10px] font-semibold">
            <span className="rounded-md bg-panel2 px-2 py-0.5">Zamówienia</span>
            <span className="px-2 py-0.5 text-muted">Restauracje</span>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="flex items-center gap-2.5">
            <span className="flex w-9 flex-col items-center rounded-md bg-gold-soft py-0.5 text-gold">
              <b className="font-display text-sm leading-none">9</b>
              <span className="text-[8px] uppercase">pt</span>
            </span>
            <div className="flex-1">
              <p className="text-xs font-semibold">Bistro pod Kostką</p>
              <p className="flex items-center gap-1 text-[9px] text-gold">
                <CalendarDays size={9} /> Wieczór z nowościami
              </p>
            </div>
            <span className="flex items-center gap-0.5 font-mono text-[11px] text-gold">
              <Star size={10} className="fill-gold" /> 4.3
            </span>
          </div>
          <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_52px] gap-y-1 text-[10px]">
            <span className="text-[9px] text-muted">Osoba</span>
            <span className="text-[9px] text-muted">Zamówienie</span>
            <span className="text-right text-[9px] text-muted">Cena (zł)</span>
            {items.map((it) => (
              <Fragment key={it.u.name}>
                <span className="flex items-center gap-1">
                  <MockAvatar user={it.u} size={14} ring={false} /> {it.u.name}
                </span>
                <span className="truncate">
                  {it.what} <span className="text-gold">{"★".repeat(it.stars)}</span>
                </span>
                <span className="text-right font-mono">{it.price}</span>
              </Fragment>
            ))}
          </div>
          <div className="mt-2.5 rounded-lg bg-panel2/60 p-2 text-[10px]">
            <p className="font-semibold">
              Rozliczenie <span className="font-normal text-muted">· Dostawa: 12,00 zł (3,00 zł/os.) · zapłaciła: Kasia</span>
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="rounded-full bg-felt-soft px-2 py-0.5 text-[9px] text-felt">Ania · rozliczono</span>
              <span className="rounded-full bg-felt-soft px-2 py-0.5 text-[9px] text-felt">Bartek · rozliczono</span>
              <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[9px] text-gold">Tomek · 34,00 zł</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-panel p-2.5 text-[10px]">
          <p className="flex-1 font-semibold">
            Kebab u Mistrza <span className="font-normal text-muted">· ul. Planszowa 6</span>
          </p>
          <span className="flex items-center gap-1 text-muted">
            <Package size={10} /> 9 zamówień
          </span>
          <span className="font-mono text-gold">★ 4.6</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Święta ───────────────────────────────────────────────────────────────── */

const CONFETTI = [
  ["12%", "18%", "#D6AA62"],
  ["80%", "12%", "#6EAA80"],
  ["20%", "78%", "#D67058"],
  ["88%", "70%", "#D6AA62"],
  ["50%", "8%", "#6EAA80"],
  ["65%", "88%", "#D67058"],
];

export function SwietaScreen() {
  return (
    <div className="text-left">
      <MiniNav active="Święta" />
      <div className="space-y-3 p-4 sm:p-5">
        <Heading title="Święta ✦" sub="Losowanie „kto komu kupuje prezent” na święta" />
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-panel p-3">
            <p className="text-xs font-semibold">Wymiana prezentów 2026</p>
            <p className="text-[10px] text-muted">Budżet: 100 zł · 24.12 u Bartka</p>
            <div className="mt-3 flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-line bg-panel2/50 p-4 text-center">
              <Gift size={30} className="text-danger" />
              <p className="text-[11px] font-semibold">Kliknij, aby odpakować</p>
              <p className="text-[9px] text-muted">Upewnij się, że nikt nie zagląda Ci przez ramię!</p>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[9px] text-muted">
              <AvatarStack size={16} /> 5 uczestników
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-gold/40 bg-gold-soft/40 p-4 text-center">
            {CONFETTI.map(([left, top, bg]) => (
              <i key={left + top} className="absolute h-1.5 w-1.5 rotate-45 rounded-sm" style={{ left, top, background: bg }} />
            ))}
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gold">Kupujesz prezent dla</p>
            <div className="mx-auto mt-2 w-fit">
              <MockAvatar user={ola} size={44} />
            </div>
            <p className="mt-2 font-display text-xl font-extrabold">Ola 🎁</p>
            <span className="mt-2 inline-block rounded-lg border border-line px-2.5 py-1 text-[10px] text-muted">Ukryj</span>
          </div>
        </div>
      </div>
    </div>
  );
}
