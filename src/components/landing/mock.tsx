// Generyczne elementy makiet na stronie startowej: fikcyjni gracze, okładki gier rysowane w SVG
// i ramka okna przeglądarki. Żadnych prawdziwych zdjęć ani nazwisk.

export type MockUser = { name: string; color: string };

export const MOCK_USERS: MockUser[] = [
  { name: "Ania", color: "#6EAA80" },
  { name: "Bartek", color: "#D6AA62" },
  { name: "Kasia", color: "#C9826B" },
  { name: "Tomek", color: "#7F9CC2" },
  { name: "Ola", color: "#A88BC7" },
];

export function MockAvatar({ user, size = 28, ring = true }: { user: MockUser; size?: number; ring?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-[#16110c] ${
        ring ? "ring-2 ring-panel" : ""
      }`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(140deg, ${user.color}, color-mix(in srgb, ${user.color} 62%, #000))`,
      }}
      aria-hidden
    >
      {user.name[0]}
    </span>
  );
}

export function AvatarStack({ users = MOCK_USERS, size = 28 }: { users?: MockUser[]; size?: number }) {
  return (
    <span className="flex -space-x-2">
      {users.map((u) => (
        <MockAvatar key={u.name} user={u} size={size} />
      ))}
    </span>
  );
}

/* ─── Okładki gier ─────────────────────────────────────────────────────────── */

type CoverKind = "hex" | "waves" | "peaks" | "stars" | "tower" | "cards";

export type MockGame = { name: string; players: string; time: string; rating: number; plays: number; cover: CoverKind; hue: [string, string] };

export const MOCK_GAMES: MockGame[] = [
  { name: "Wyspa Kartografów", players: "1–4", time: "45 min", rating: 8.6, plays: 23, cover: "hex", hue: ["#4E8460", "#1E2B21"] },
  { name: "Szlak Karawan", players: "2–5", time: "60 min", rating: 8.1, plays: 17, cover: "peaks", hue: ["#B08642", "#34281A"] },
  { name: "Głębiny", players: "2–4", time: "40 min", rating: 7.9, plays: 12, cover: "waves", hue: ["#4F7896", "#18242E"] },
  { name: "Kosmiczni Kupcy", players: "3–5", time: "90 min", rating: 8.4, plays: 9, cover: "stars", hue: ["#6B5A94", "#1C1729"] },
  { name: "Wieża Alchemików", players: "2–4", time: "75 min", rating: 7.6, plays: 14, cover: "tower", hue: ["#A8604A", "#2E1913"] },
  { name: "Blef i Korona", players: "3–6", time: "20 min", rating: 7.3, plays: 31, cover: "cards", hue: ["#8A7A3C", "#26200F"] },
];

export function GameCover({ game, className = "" }: { game: MockGame; className?: string }) {
  const [a, b] = game.hue;
  const id = `g-${game.cover}`;
  return (
    <svg viewBox="0 0 120 120" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#${id})`} />
      <g fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="2">
        {game.cover === "hex" &&
          [0, 1, 2].map((r) =>
            [0, 1, 2, 3].map((c) => {
              const x = 18 + c * 28 + (r % 2) * 14;
              const y = 30 + r * 24;
              return <path key={`${r}-${c}`} d={`M${x} ${y - 14}l12 7v14l-12 7l-12-7v-14z`} />;
            }),
          )}
        {game.cover === "waves" &&
          [0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M-10 ${40 + i * 16} q 15 -12 30 0 t 30 0 t 30 0 t 30 0 t 30 0`} />
          ))}
        {game.cover === "peaks" && (
          <>
            <path d="M0 100 L35 50 L55 75 L80 35 L120 100" fill="#fff" fillOpacity="0.12" />
            <path d="M0 110 L30 80 L60 95 L90 70 L120 105" />
            <circle cx="92" cy="26" r="9" fill="#fff" fillOpacity="0.25" stroke="none" />
          </>
        )}
        {game.cover === "stars" && (
          <>
            <circle cx="60" cy="64" r="26" />
            <ellipse cx="60" cy="64" rx="46" ry="12" transform="rotate(-18 60 64)" />
            {[[18, 20], [96, 18], [104, 92], [24, 98], [70, 22]].map(([x, y]) => (
              <circle key={`${x}${y}`} cx={x} cy={y} r="1.8" fill="#fff" fillOpacity="0.6" stroke="none" />
            ))}
          </>
        )}
        {game.cover === "tower" && (
          <>
            <path d="M46 104 V48 h28 V104" fill="#fff" fillOpacity="0.1" />
            <path d="M42 48 h36 l-18 -26 z" fill="#fff" fillOpacity="0.18" />
            <circle cx="60" cy="66" r="5" />
            <path d="M20 104 h80" />
          </>
        )}
        {game.cover === "cards" && (
          <>
            <rect x="26" y="34" width="38" height="54" rx="5" transform="rotate(-14 45 61)" fill="#fff" fillOpacity="0.1" />
            <rect x="56" y="30" width="38" height="54" rx="5" transform="rotate(12 75 57)" fill="#fff" fillOpacity="0.16" />
            <path d="M66 46 l9 8 l9 -8 v16 h-18 z" />
          </>
        )}
      </g>
    </svg>
  );
}

/* ─── Ramka okna aplikacji ─────────────────────────────────────────────────── */

export function BrowserFrame({ url, children, className = "" }: { url: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-line bg-ink shadow-panel ${className}`}>
      <div className="flex items-center gap-3 border-b border-line/70 bg-surface/90 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <i className="h-2.5 w-2.5 rounded-full bg-danger/70" />
          <i className="h-2.5 w-2.5 rounded-full bg-gold/70" />
          <i className="h-2.5 w-2.5 rounded-full bg-felt/70" />
        </span>
        <span className="mx-auto max-w-[60%] truncate rounded-md bg-panel2/80 px-3 py-0.5 font-mono text-[11px] text-muted">
          {url}
        </span>
        <span className="w-[42px]" aria-hidden />
      </div>
      {children}
    </div>
  );
}
