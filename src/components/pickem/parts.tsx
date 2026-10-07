import type { PickemMatch, PickemTeam, SlotInput } from "@/lib/pickem";
import { formatMatchTime } from "@/lib/pickem-time";

const LOGO_COLORS = ["#6EAA80", "#D6AA62", "#7F9CC2", "#D67058", "#B48CD6", "#5FB3B3"];

export function TeamLogo({ team, size = 36 }: { team: PickemTeam | null | undefined; size?: number }) {
  if (!team) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-dashed border-line font-mono text-xs text-muted"
        style={{ width: size, height: size }}
      >
        ?
      </span>
    );
  }
  if (team.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={team.logo_url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className="shrink-0 rounded-lg bg-panel2 object-contain p-0.5"
        style={{ width: size, height: size }}
      />
    );
  }
  const tag = team.short ?? team.name.slice(0, 3);
  const idx = [...team.name].reduce((a, c) => a + c.charCodeAt(0), 0) % LOGO_COLORS.length;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg font-mono font-bold text-onaccent"
      style={{ width: size, height: size, background: LOGO_COLORS[idx], fontSize: size * (tag.length > 3 ? 0.26 : 0.32) }}
    >
      {tag.toUpperCase()}
    </span>
  );
}

export const teamName = (t: PickemTeam | null | undefined) => (t ? t.name : "Do ustalenia");

// Nazwa meczu w odwołaniach („Zwycięzca: …”) i na listach wyboru
export function matchTitle(m: PickemMatch, teams: Map<string, PickemTeam>): string {
  if (m.label) return m.label;
  const a = m.a ? teams.get(m.a)?.short ?? teams.get(m.a)?.name : null;
  const b = m.b ? teams.get(m.b)?.short ?? teams.get(m.b)?.name : null;
  if (a && b) return `${a} vs ${b}`;
  return `${m.stage ? `${m.stage} · ` : ""}${formatMatchTime(m.starts_at)}`;
}

// Opis nieznanej jeszcze strony meczu, np. „Zwycięzca: Ćwierćfinał 1”
export function slotHint(slot: SlotInput, matches: Map<string, PickemMatch>, teams: Map<string, PickemTeam>): string {
  if (!slot || "team_id" in slot) return "Do ustalenia";
  const src = matches.get(slot.match_id);
  const name = src ? matchTitle(src, teams) : "usunięty mecz";
  return `${slot.kind === "winner" ? "Zwycięzca" : "Przegrany"}: ${name}`;
}
