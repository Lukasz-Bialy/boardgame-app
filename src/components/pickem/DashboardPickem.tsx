import Link from "next/link";
import { ArrowRight, Check, Clock, Trophy } from "lucide-react";
import { Avatar } from "@/components/ui";
import { PLAYERS } from "@/lib/users";
import type { OpenPickemMatch } from "@/lib/pickem";
import { formatMatchTime, timeLeft } from "@/lib/pickem-time";
import { TeamLogo } from "./parts";

const MAX_ROWS = 6;

// 1 mecz czeka, 2–4 mecze czekają, 5+ meczów czeka (12–14 też „meczów”)
function czeka(n: number) {
  if (n === 1) return "mecz czeka";
  const d = n % 10;
  const dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? "mecze czekają" : "meczów czeka";
}

// Panel pulpitu: mecze do obstawienia ze wszystkich turniejów — najpierw te bez Twojego typu
export default function DashboardPickem({ matches }: { matches: OpenPickemMatch[] }) {
  if (matches.length === 0) return null;
  const missing = matches.filter((m) => !m.picked);
  const rows = [...missing, ...matches.filter((m) => m.picked)].slice(0, MAX_ROWS);
  const now = Date.now();
  // Jeden turniej z brakami — przycisk prowadzi prosto do niego
  const tokens = [...new Set(missing.map((m) => m.token))];
  const allHref = tokens.length === 1 ? `/pickem/${tokens[0]}` : "/pickem";

  return (
    <section className={`panel relative overflow-hidden p-5 ${missing.length ? "border-gold/40" : ""}`}>
      <div
        className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${
          missing.length ? "from-gold via-gold/40" : "from-felt/70 via-felt/30"
        } to-transparent`}
      />
      <div className="relative mb-4 flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <Trophy size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">Pick&apos;em</p>
          <h2 className="font-display text-xl font-extrabold tracking-tight text-cream">
            {missing.length ? "Mecze do obstawienia" : "Wszystko obstawione"}
          </h2>
        </div>
        {missing.length > 0 && (
          <span className="chip text-gold">
            {missing.length} {czeka(missing.length)} na Twój typ
          </span>
        )}
        <Link href={allHref} className="btn-ghost px-3 py-1.5 text-xs">
          Przejdź do Pick&apos;em <ArrowRight size={13} />
        </Link>
      </div>

      <ul className="relative grid gap-2 lg:grid-cols-2">
        {rows.map((m) => (
          <li key={m.id}>
            <Link
              href={`/pickem/${m.token}`}
              className={`group flex items-center gap-3 rounded-xl border px-3.5 py-3 transition hover:bg-panel2 ${
                m.picked ? "border-line/40 bg-panel2/20" : "border-line/60 bg-panel2/40 hover:border-gold/50"
              }`}
            >
              <span className="flex shrink-0 items-center gap-1.5">
                <TeamLogo team={m.a} size={30} />
                <span className="text-[10px] font-bold uppercase text-muted">vs</span>
                <TeamLogo team={m.b} size={30} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-cream">
                  {m.a.short ?? m.a.name} – {m.b.short ?? m.b.name}
                  <span className="ml-2 font-mono text-xs font-normal text-gold">{m.points} pkt</span>
                  {m.exact && <span className="ml-2 text-xs font-normal text-gold">· na wynik</span>}
                </p>
                <p className="flex items-center gap-1 truncate text-xs text-muted">
                  <Clock size={11} className="shrink-0" />
                  {formatMatchTime(m.starts_at)} · {timeLeft(m.starts_at, now)} · {m.tournament}
                </p>
              </div>
              <span className="hidden items-center gap-1.5 sm:flex" title="Kto już typował">
                <span className="flex -space-x-1.5">
                  {m.voters.map((v) => (
                    <span key={v} className="rounded-full ring-2 ring-panel">
                      <Avatar username={v} size={18} />
                    </span>
                  ))}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted">
                  {m.voters.length}/{PLAYERS.length}
                </span>
              </span>
              {m.picked ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-felt">
                  <Check size={14} /> Obstawione
                </span>
              ) : (
                <span className="btn-primary shrink-0 px-3 py-1.5 text-xs">
                  Typuj <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {matches.length > rows.length && (
        <p className="relative mt-3 text-xs text-muted">
          …i {matches.length - rows.length} więcej —{" "}
          <Link href={allHref} className="text-felt hover:underline">
            zobacz wszystkie
          </Link>
        </p>
      )}
    </section>
  );
}
