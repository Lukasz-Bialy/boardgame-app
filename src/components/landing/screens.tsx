// Makiety ekranów aplikacji na stronę startową — statyczne, z fikcyjnymi danymi.
import { CalendarDays, Check, Dices, Star, Trophy, Vote, Users, Clock } from "lucide-react";
import { AvatarStack, GameCover, MOCK_GAMES, MOCK_USERS, MockAvatar } from "./mock";

const [ania, bartek, kasia, tomek, ola] = MOCK_USERS;

const NAV_ITEMS = ["Pulpit", "Kolekcja", "Historia", "Ankiety", "Kalendarz", "Wishlista", "Losowanie", "Kebab", "Liga", "Przygoda", "Święta"];

// Belka makiety: sześć zakładek wokół aktywnej (wszystkie by się nie zmieściły)
export function MiniNav({ active }: { active: string }) {
  const start = Math.max(0, Math.min(NAV_ITEMS.indexOf(active) - 2, NAV_ITEMS.length - 6));
  const items = NAV_ITEMS.slice(start, start + 6);
  return (
    <div className="flex items-center gap-1 border-b border-line/60 bg-surface/60 px-4 py-2">
      <span className="mr-2 h-5 w-5 rounded-md bg-felt" aria-hidden />
      {items.map((i) => (
        <span
          key={i}
          className={`hidden rounded-lg px-2.5 py-1 text-[11px] font-medium sm:inline ${
            i === active ? "bg-panel2 text-cream" : "text-muted"
          }`}
        >
          {i}
        </span>
      ))}
      <span className="ml-auto">
        <MockAvatar user={ania} size={22} ring={false} />
      </span>
    </div>
  );
}

export function Tile({ label, value, accent, icon: Icon }: { label: string; value: string; accent: "felt" | "gold"; icon: typeof Dices }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-panel p-3">
      <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${accent === "felt" ? "from-felt/70 via-felt/30" : "from-gold/70 via-gold/30"} to-transparent`} />
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">{value}</p>
      <Icon size={44} className="absolute -bottom-2 -right-2 opacity-[0.07]" />
    </div>
  );
}

export function DashboardScreen() {
  return (
    <div className="text-left">
      <MiniNav active="Pulpit" />
      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <p className="text-[11px] text-muted">Dobry wieczór,</p>
          <p className="font-display text-xl font-extrabold">Ania 👋</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Tile label="Gry w kolekcji" value="48" accent="felt" icon={Dices} />
          <Tile label="Rozegrane partie" value="312" accent="gold" icon={Trophy} />
          <Tile label="Otwarte ankiety" value="2" accent="felt" icon={Vote} />
          <Tile label="Najbliższe spotkanie" value="pt" accent="gold" icon={CalendarDays} />
        </div>
        <div className="grid gap-2.5 sm:grid-cols-5">
          <div className="rounded-xl border border-line bg-panel p-3 sm:col-span-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Ostatnie zwycięstwa</p>
            {[
              { game: MOCK_GAMES[0], user: kasia, when: "wczoraj" },
              { game: MOCK_GAMES[3], user: tomek, when: "3 dni temu" },
              { game: MOCK_GAMES[1], user: ania, when: "tydzień temu" },
            ].map(({ game, user, when }) => (
              <div key={game.name} className="flex items-center gap-2.5 border-t border-line/50 py-2 first:border-0">
                <GameCover game={game} className="h-8 w-8 rounded-md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{game.name}</p>
                  <p className="text-[10px] text-muted">{when}</p>
                </div>
                <span className="flex items-center gap-1.5 text-[11px] text-gold">
                  <Trophy size={11} /> {user.name}
                </span>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-line bg-panel p-3 sm:col-span-2">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Najwyżej oceniane</p>
            {MOCK_GAMES.slice(0, 3).map((g, i) => (
              <div key={g.name} className="flex items-center gap-2 py-1.5">
                <span className="w-3 font-mono text-[10px] text-muted">{i + 1}</span>
                <span className="flex-1 truncate text-xs">{g.name}</span>
                <span className="flex items-center gap-0.5 font-mono text-[11px] text-gold">
                  <Star size={10} className="fill-gold" />
                  {g.rating.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CollectionScreen() {
  return (
    <div className="text-left">
      <MiniNav active="Kolekcja" />
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <p className="font-display text-lg font-extrabold">Kolekcja gier</p>
          <span className="rounded-full bg-felt-soft px-2 py-0.5 text-[10px] font-semibold text-felt">48</span>
          <span className="ml-auto hidden rounded-lg border border-line bg-surface/80 px-3 py-1 text-[11px] text-muted/70 sm:block">
            Szukaj gry…
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {MOCK_GAMES.map((g) => (
            <div key={g.name} className="overflow-hidden rounded-xl border border-line bg-panel">
              <GameCover game={g} className="aspect-[16/10] w-full" />
              <div className="p-2.5">
                <p className="truncate text-xs font-semibold">{g.name}</p>
                <div className="mt-1.5 flex items-center gap-2.5 text-[10px] text-muted">
                  <span className="flex items-center gap-1"><Users size={10} />{g.players}</span>
                  <span className="flex items-center gap-1"><Clock size={10} />{g.time}</span>
                  <span className="ml-auto flex items-center gap-0.5 font-mono text-gold">
                    <Star size={9} className="fill-gold" />
                    {g.rating.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PollScreen() {
  const options = [
    { game: MOCK_GAMES[3], votes: [ania, tomek, ola, kasia] },
    { game: MOCK_GAMES[0], votes: [bartek, kasia, ania] },
    { game: MOCK_GAMES[4], votes: [tomek] },
  ];
  return (
    <div className="text-left">
      <MiniNav active="Ankiety" />
      <div className="p-4 sm:p-5">
        <span className="rounded-full border border-felt/40 bg-felt-soft px-2 py-0.5 text-[10px] font-semibold text-felt">
          Otwarta · W co zagramy?
        </span>
        <p className="mt-2 font-display text-lg font-extrabold">Piątkowy wieczór — wybieramy grę</p>
        <p className="text-[11px] text-muted">5 z 5 osób zagłosowało</p>
        <div className="mt-4 space-y-2.5">
          {options.map(({ game, votes }, i) => (
            <div key={game.name} className={`relative overflow-hidden rounded-xl border p-3 ${i === 0 ? "border-felt/60 bg-felt-soft/40" : "border-line bg-panel"}`}>
              <div className="absolute inset-y-0 left-0 bg-felt/10" style={{ width: `${(votes.length / 5) * 100}%` }} />
              <div className="relative flex items-center gap-3">
                <GameCover game={game} className="h-9 w-9 rounded-md" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-xs font-semibold">
                    {game.name}
                    {i === 0 && <Check size={12} className="text-felt" />}
                  </p>
                  <div className="mt-1">
                    <AvatarStack users={votes} size={18} />
                  </div>
                </div>
                <span className="font-mono text-sm font-bold tabular-nums">{votes.length}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

