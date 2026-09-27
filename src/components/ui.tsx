import { avatarOf, displayNameOf } from "@/lib/users";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect x="3" y="3" width="26" height="26" rx="7" fill="#34A578" />
        <rect x="3" y="3" width="26" height="26" rx="7" stroke="#2A8862" strokeWidth="1.5" />
        <circle cx="11" cy="11" r="2.4" fill="#13151A" />
        <circle cx="21" cy="11" r="2.4" fill="#13151A" />
        <circle cx="16" cy="16" r="2.4" fill="#13151A" />
        <circle cx="11" cy="21" r="2.4" fill="#13151A" />
        <circle cx="21" cy="21" r="2.4" fill="#13151A" />
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
