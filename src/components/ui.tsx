import { avatarOf, displayNameOf } from "@/lib/users";

// Kolory z tokenów motywu (felt/gold), więc logo zmienia się razem z paletą i trybem jasnym
const felt = "rgb(var(--c-felt))";
const feltDark = "rgb(var(--c-felt-dark))";
const gold = "rgb(var(--c-gold))";
const seam = "color-mix(in srgb, rgb(var(--c-felt-dark)) 55%, #000)";

// Logo strony: belka aplikacji, strona startowa i karta logowania.
// Warianty — domyślny zmieniasz tutaj:
//   "pawnspawn" — pionek pojawiający się na świecącej platformie (logo marki PawnSpawn)
//   "chess"     — chłopiec przy szachownicy z pionkiem
//   "console"   — chłopiec w słuchawkach z padem
//   "dice"      — kostka w rzucie izometrycznym
type LogoVariant = "pawnspawn" | "chess" | "console" | "dice";
const LOGO_VARIANT: LogoVariant = "pawnspawn";

export function Logo({ size = 28, variant = LOGO_VARIANT }: { size?: number; variant?: LogoVariant }) {
  if (variant === "pawnspawn") return <PawnSpawnLogo size={size} />;
  if (variant === "dice") return <DiceLogo size={size} />;
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <BoyBadge>{variant === "chess" ? <ChessBoy /> : <ConsoleBoy />}</BoyBadge>
      </svg>
    </span>
  );
}

// Pionek „spawnujący się” na platformie: smuga światła od dołu i piksele wokół (gry komputerowe),
// złoty pionek (planszówki). Stałe id gradientów — identyczne definicje, kolizja niczego nie psuje.
function PawnSpawnLogo({ size }: { size: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <defs>
          <linearGradient id="logo-beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: felt, stopOpacity: 0 }} />
            <stop offset="1" style={{ stopColor: felt, stopOpacity: 0.45 }} />
          </linearGradient>
          <linearGradient id="logo-pawn" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "color-mix(in srgb, rgb(var(--c-gold)) 75%, #fff)" }} />
            <stop offset="1" style={{ stopColor: "rgb(var(--c-gold-dark))" }} />
          </linearGradient>
        </defs>
        {/* smuga światła */}
        <path d="M7.5 27 L10 4 H22 L24.5 27 Z" fill="url(#logo-beam)" />
        {/* platforma */}
        <ellipse cx="16" cy="27" rx="12.5" ry="3.3" strokeWidth="1.3" style={{ fill: felt, fillOpacity: 0.2, stroke: felt }} />
        <ellipse cx="16" cy="27" rx="7.5" ry="1.7" style={{ fill: felt, fillOpacity: 0.55 }} />
        {/* pionek */}
        <g fill="url(#logo-pawn)">
          <circle cx="16" cy="7.6" r="3.7" />
          <rect x="11.6" y="11.4" width="8.8" height="2" rx="1" />
          <path d="M13.4 13.2 H18.6 C18.6 17 19.6 20 21.8 22.6 H10.2 C12.4 20 13.4 17 13.4 13.2 Z" />
          <rect x="8.8" y="22.2" width="14.4" height="3.4" rx="1.7" />
        </g>
        <circle cx="14.8" cy="6.4" r="1.1" fill="#fff" fillOpacity=".45" />
        {/* piksele */}
        <g style={{ fill: felt }}>
          <rect x="4.2" y="19" width="2" height="2" rx=".3" opacity=".9" />
          <rect x="25.6" y="15.5" width="2" height="2" rx=".3" opacity=".8" />
          <rect x="6.4" y="11" width="1.6" height="1.6" rx=".3" opacity=".6" />
          <rect x="24" y="7.5" width="1.6" height="1.6" rx=".3" opacity=".5" />
          <rect x="27.2" y="22" width="1.4" height="1.4" rx=".3" opacity=".7" />
          <rect x="8.4" y="4.6" width="1.2" height="1.2" rx=".2" opacity=".35" />
        </g>
      </svg>
    </span>
  );
}

// Nazwa marki: „Pawn” w kolorze tekstu, „Spawn” w kolorze sukna
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-tight ${className}`}>
      Pawn<span className="text-felt">Spawn</span>
    </span>
  );
}

const SKIN = "#F4C9A0";
const HAIR = "#5B3A22";
const INK = "#2A2118";
const CREAM = "#FFF3DC";

// Okrągła plakietka w kolorze sukna ze złotą obwódką; ilustracja przycięta do koła.
// Stałe id clipPath — kilka logo na stronie ma identyczną definicję, więc kolizja niczego nie psuje.
function BoyBadge({ children }: { children: React.ReactNode }) {
  return (
    <>
      <clipPath id="logo-badge">
        <circle cx="16" cy="16" r="15.5" />
      </clipPath>
      <circle cx="16" cy="16" r="15.5" style={{ fill: feltDark }} />
      <g clipPath="url(#logo-badge)">
        <circle cx="16" cy="16" r="12.5" fill="#fff" fillOpacity=".07" />
        {children}
      </g>
      <circle cx="16" cy="16" r="15.2" fill="none" strokeOpacity=".75" strokeWidth=".7" style={{ stroke: gold }} />
    </>
  );
}

// Twarz wspólna dla obu chłopców; dy przesuwa ją w pionie
function BoyFace({ dy = 0 }: { dy?: number }) {
  return (
    <g transform={`translate(0 ${dy})`}>
      <circle cx="16" cy="12.2" r="5.6" fill={SKIN} />
      <path
        d="M10.3 12 C10 7.4 13 5.6 16.2 5.7 C19.6 5.8 22.2 7.8 21.7 11.6 C20.6 10 19 9.4 17.6 9.6 C16.4 8.6 14.4 8.4 12.6 9.6 C11.7 10.2 11 11 10.3 12 Z"
        fill={HAIR}
      />
      <circle cx="14" cy="13.2" r=".75" fill={INK} />
      <circle cx="18" cy="13.2" r=".75" fill={INK} />
      <circle cx="12.7" cy="14.9" r=".9" fill="#E8907A" fillOpacity=".55" />
      <circle cx="19.3" cy="14.9" r=".9" fill="#E8907A" fillOpacity=".55" />
      <path d="M15 15.6 Q16 16.4 17 15.6" fill="none" stroke={INK} strokeWidth=".7" strokeLinecap="round" />
    </g>
  );
}

function ChessBoy() {
  return (
    <>
      {/* sweter z kołnierzykiem */}
      <path d="M7.5 27 C7.5 20.5 11 18.6 16 18.6 S24.5 20.5 24.5 27 Z" style={{ fill: gold }} />
      <path d="M13.6 18.9 L16 21.2 L18.4 18.9" fill="none" stroke="#FFF8E8" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      <BoyFace />
      {/* kosmyk */}
      <path d="M18.6 6.2 C19.6 5.2 20.8 5.1 21.4 5.5 C20.6 5.7 20 6.2 19.6 6.9 Z" fill={HAIR} />
      {/* szachownica w perspektywie: dwa rzędy pól */}
      <path d="M2 23.2 H30 L32 32 H0 Z" fill={CREAM} />
      <path
        d="M5.5 23.2 H9 L8.7 27.4 H4.9 Z M12.5 23.2 H16 V27.4 H12.2 Z M19.5 23.2 H23 L23.3 27.4 H19.6 Z M26.5 23.2 H30 L31 27.4 H27.1 Z"
        fill="#3A2A1C"
      />
      <path
        d="M1.1 27.4 H4.9 L4.2 32 H0 Z M8.7 27.4 H12.2 L11.9 32 H8.4 Z M16 27.4 H19.6 V32 H16 Z M23.3 27.4 H27.1 L27.6 32 H23.8 Z"
        fill="#3A2A1C"
      />
      {/* dłoń na krawędzi planszy */}
      <ellipse cx="10.4" cy="23.4" rx="1.7" ry="1.2" fill={SKIN} />
      {/* pionek */}
      <g stroke={INK} strokeWidth=".5" style={{ fill: gold }}>
        <circle cx="22.6" cy="18.6" r="1.6" />
        <path d="M21.2 24.6 L21.9 20.6 H23.3 L24 24.6 Z" />
        <rect x="20.4" y="24" width="4.4" height="1.4" rx=".6" />
      </g>
    </>
  );
}

function ConsoleBoy() {
  return (
    <>
      <path d="M6.5 32 C6.5 22.5 10.5 19.6 16 19.6 S25.5 22.5 25.5 32 Z" style={{ fill: gold }} />
      <BoyFace dy={0.2} />
      {/* słuchawki */}
      <path d="M9.6 12.6 C9.6 6.4 22.4 6.4 22.4 12.6" fill="none" stroke={INK} strokeWidth="1.1" />
      <rect x="8.6" y="11.4" width="2.4" height="3.6" rx="1.1" fill={INK} />
      <rect x="21" y="11.4" width="2.4" height="3.6" rx="1.1" fill={INK} />
      {/* pad */}
      <path
        d="M9.2 21.4 C10.4 20.6 12.4 21 13.6 21.4 H18.4 C19.6 21 21.6 20.6 22.8 21.4 C24.6 22.6 25.4 26.4 24.4 27.6 C23.4 28.8 21.8 27.6 20.6 26 H11.4 C10.2 27.6 8.6 28.8 7.6 27.6 C6.6 26.4 7.4 22.6 9.2 21.4 Z"
        fill={INK}
      />
      <path d="M10.1 22.6 v2.6 M8.8 23.9 h2.6" stroke="#FFF8E8" strokeWidth=".9" strokeLinecap="round" />
      <circle cx="21.6" cy="23" r=".75" style={{ fill: felt }} />
      <circle cx="22.9" cy="24.3" r=".75" style={{ fill: gold }} />
      <circle cx="20.3" cy="24.3" r=".75" fill="#D67058" />
      <circle cx="21.6" cy="25.6" r=".75" fill="#7F9CC2" />
      {/* kciuki */}
      <ellipse cx="11" cy="21.3" rx="1.3" ry=".9" fill={SKIN} />
      <ellipse cx="21" cy="21.3" rx="1.3" ry=".9" fill={SKIN} />
    </>
  );
}

// Kostka w rzucie izometrycznym: każda ściana to kwadrat 1×1 przekształcony macierzą na romb,
// dzięki czemu zaokrąglenia rogów i oczka leżą w perspektywie. Gradienty mają stałe id —
// kilka logo na stronie ma identyczne definicje, więc kolizja id niczego nie psuje.
function DiceLogo({ size }: { size: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <defs>
          <linearGradient id="logo-top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "color-mix(in srgb, rgb(var(--c-felt)) 45%, #fff)" }} />
            <stop offset="1" style={{ stopColor: "color-mix(in srgb, rgb(var(--c-felt)) 80%, #fff)" }} />
          </linearGradient>
          <linearGradient id="logo-left" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" style={{ stopColor: felt }} />
            <stop offset="1" style={{ stopColor: feltDark }} />
          </linearGradient>
          <linearGradient id="logo-right" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" style={{ stopColor: feltDark }} />
            <stop offset="1" style={{ stopColor: "color-mix(in srgb, rgb(var(--c-felt-dark)) 70%, #000)" }} />
          </linearGradient>
        </defs>
        {/* Sylwetka — prześwituje jako cienkie krawędzie między ścianami */}
        <polygon
          points="16,2.6 27.6,9.3 27.6,22.7 16,29.4 4.4,22.7 4.4,9.3"
          strokeLinejoin="round"
          strokeWidth="2"
          style={{ fill: seam, stroke: seam }}
        />
        <g transform="matrix(11.3,6.5,-11.3,6.5,16,3)">
          <rect x=".035" y=".035" width=".93" height=".93" rx=".22" fill="url(#logo-top)" />
          <circle cx=".5" cy=".5" r=".15" style={{ fill: "color-mix(in srgb, rgb(var(--c-gold)) 70%, #000)" }} />
          <circle cx=".49" cy=".49" r=".13" style={{ fill: gold }} />
        </g>
        <g transform="matrix(11.3,6.5,0,13,4.7,9.5)">
          <rect x=".035" y=".035" width=".93" height=".93" rx=".22" fill="url(#logo-left)" />
          <g fill="#FFF8E8">
            <circle cx=".3" cy=".3" r=".1" />
            <circle cx=".7" cy=".7" r=".1" />
          </g>
        </g>
        <g transform="matrix(11.3,-6.5,0,13,16,16)">
          <rect x=".035" y=".035" width=".93" height=".93" rx=".22" fill="url(#logo-right)" />
          <g fill="#FFF8E8" fillOpacity=".88">
            <circle cx=".27" cy=".27" r=".09" />
            <circle cx=".5" cy=".5" r=".09" />
            <circle cx=".73" cy=".73" r=".09" />
          </g>
        </g>
        {/* Błysk */}
        <path d="M27 1.2 L27.7 3.3 L29.8 4 L27.7 4.7 L27 6.8 L26.3 4.7 L24.2 4 L26.3 3.3 Z" style={{ fill: gold }} />
      </svg>
    </span>
  );
}

const AVATAR_COLORS = ["#34A578", "#E8B04B", "#6C8CFF", "#E5564B", "#B47CFF"];

// Rozmiar skalowany przez --avatar-scale (globals.css: 1.5× na dużych ekranach)
const scaled = (px: number) => `calc(${px}px * var(--avatar-scale, 1))`;

export function Avatar({ username, size = 28 }: { username: string; size?: number }) {
  const name = displayNameOf(username);
  const src = avatarOf(username);
  const dim = scaled(size);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        title={name}
        width={size}
        height={size}
        loading="lazy"
        className="inline-block shrink-0 rounded-full object-cover ring-1 ring-line/60"
        style={{ width: dim, height: dim }}
      />
    );
  }
  const idx = [...username].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return (
    <span
      title={name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-onaccent"
      style={{
        width: dim,
        height: dim,
        background: AVATAR_COLORS[idx],
        fontSize: scaled(size * 0.42),
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function PlaceBadge({ place }: { place: number }) {
  const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : null;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-sm">
      {medal ? <span>{medal}</span> : null}
      <span className={place === 1 ? "text-gold" : "text-cream"}>{place}.</span>
    </span>
  );
}

export function players(min: number | null, max: number | null): string {
  if (min && max) return min === max ? `${min}` : `${min}–${max}`;
  if (min) return `${min}+`;
  if (max) return `do ${max}`;
  return "—";
}

export function minutes(m: number | null): string {
  if (!m) return "—";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
