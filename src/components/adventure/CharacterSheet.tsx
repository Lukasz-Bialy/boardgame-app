"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Backpack, HeartPulse, RefreshCw, Shield, Skull, Sparkles, Trash2 } from "lucide-react";
import GenImage from "./GenImage";
import { ClassIcon, PortraitFallback } from "./art";
import { Avatar } from "@/components/ui";
import { api } from "@/lib/client";
import { displayNameOf } from "@/lib/users";
import {
  ABILITIES,
  ABILITY_PL,
  SKILLS,
  SKILL_NAMES,
  XP_FOR_LEVEL,
  DEAD,
  STABLE,
  checkModifier,
  classById,
  fmtMod,
  mod,
  profBonus,
  raceById,
} from "@/lib/adventure/rules";
import type { Character } from "@/lib/adventure/types";

export function HpBar({ hp, max, enemy = false, thin = false }: { hp: number; max: number; enemy?: boolean; thin?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (hp / max) * 100)) : 0;
  const color = enemy ? "bg-danger" : pct > 50 ? "bg-felt" : pct > 25 ? "bg-gold" : "bg-danger";
  return (
    <div className={`w-full overflow-hidden rounded-full bg-black/30 ring-1 ring-line/60 ${thin ? "h-1.5" : "h-2.5"}`}>
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// Rzuty przeciw śmierci: 3 kratki sukcesów i 3 porażek
export function DeathPips({ successes, failures, size = "md" }: { successes: number; failures: number; size?: "sm" | "md" }) {
  const dot = size === "sm" ? "h-2 w-2" : "h-3 w-3";
  const row = (n: number, on: string, label: string) => (
    <span className="inline-flex items-center gap-1" title={`${label}: ${n}/3`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`${dot} rounded-full border ${i < n ? on : "border-line bg-black/20"}`} />
      ))}
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-2 ${size === "sm" ? "text-[10px]" : "text-xs"}`}>
      {row(successes, "border-felt bg-felt", "Sukcesy")}
      <span className="text-muted">·</span>
      {row(failures, "border-danger bg-danger", "Porażki")}
    </span>
  );
}

// Jaki jest stan życia postaci przy 0 PW
export function lifeState(ch: Character): "alive" | "dying" | "stable" | "dead" {
  if (ch.conditions.includes(DEAD)) return "dead";
  if (ch.hp > 0) return "alive";
  return ch.conditions.includes(STABLE) ? "stable" : "dying";
}

export function Portrait({ ch, className = "" }: { ch: Character; className?: string }) {
  return (
    <GenImage
      id={ch.portrait_image_id}
      alt={ch.name}
      className={className}
      loadingLabel="Malowanie portretu…"
      fallback={<PortraitFallback classId={ch.class_id} raceId={ch.race_id} name={ch.name} />}
    />
  );
}

// Miniatura w panelu drużyny
export function PartyCard({
  ch,
  status,
  onOpen,
}: {
  ch: Character;
  status: "acted" | "waiting" | "roll" | null;
  onOpen: () => void;
}) {
  const cls = classById(ch.class_id);
  const down = ch.hp <= 0;
  const life = lifeState(ch);
  return (
    <button
      onClick={onOpen}
      className={`group flex w-full items-center gap-3 rounded-xl border border-line/70 bg-panel2/40 p-2 text-left transition hover:border-gold/50 hover:bg-panel2 ${
        down ? "opacity-70 grayscale" : ""
      }`}
    >
      <div className="portrait-frame h-14 w-12 shrink-0 rounded-lg">
        <Portrait ch={ch} className="h-full w-full rounded-[7px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-tale text-[15px] font-semibold text-cream">{ch.name}</span>
          {status === "acted" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-felt" title="Zagrał w tej rundzie" />}
          {status === "waiting" && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-gold" title="Czekamy na ruch" />}
          {status === "roll" && <span className="shrink-0 text-[10px] font-semibold uppercase text-gold">rzut!</span>}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted">
          <ClassIcon classId={ch.class_id} size={11} />
          {raceById(ch.race_id)?.name} {cls?.name} · {ch.level} poz.
        </div>
        {life === "alive" ? (
          <div className="mt-1 flex items-center gap-2">
            <HpBar hp={ch.hp} max={ch.max_hp} thin />
            <span className="shrink-0 font-mono text-[10px] text-muted">
              {ch.hp}/{ch.max_hp}
            </span>
          </div>
        ) : life === "dying" ? (
          <div className="mt-1 flex items-center gap-2 text-[10px] font-semibold uppercase text-danger">
            umiera <DeathPips successes={ch.death_successes} failures={ch.death_failures} size="sm" />
          </div>
        ) : life === "stable" ? (
          <div className="mt-1 text-[10px] font-semibold uppercase text-gold">stabilny · nieprzytomny</div>
        ) : (
          <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-danger">
            <Skull size={11} /> nie żyje
          </div>
        )}
      </div>
      <Avatar username={ch.username} size={20} />
    </button>
  );
}

// Pełna plansza postaci (w modalu)
export default function CharacterSheet({
  ch,
  canEdit,
  imagesEnabled,
  onDeleted,
}: {
  ch: Character;
  canEdit: boolean;
  imagesEnabled: boolean;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const cls = classById(ch.class_id)!;
  const race = raceById(ch.race_id)!;
  const pb = profBonus(ch.level);
  const nextXp = XP_FOR_LEVEL[ch.level + 1];
  const prevXp = XP_FOR_LEVEL[ch.level] ?? 0;

  async function reroll() {
    setBusy(true);
    const res = await api(`/api/przygoda/${ch.campaign_id}/characters/${ch.id}`, "PATCH", { portrait: "reroll" });
    setBusy(false);
    if (!res.ok) return alert(res.error);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Usunąć postać ${ch.name}? Tego nie da się cofnąć.`)) return;
    const res = await api(`/api/przygoda/${ch.campaign_id}/characters/${ch.id}`, "DELETE");
    if (!res.ok) return alert(res.error);
    onDeleted?.();
    router.refresh();
  }

  return (
    <div className="sheet grid gap-5 md:grid-cols-[230px_1fr]">
      {/* Lewa kolumna: portret i podstawy */}
      <div className="space-y-3">
        <div className="portrait-frame aspect-[4/5] w-full rounded-2xl">
          <Portrait ch={ch} className="h-full w-full rounded-[13px]" />
        </div>
        {canEdit && imagesEnabled && (
          <button onClick={reroll} disabled={busy} className="btn-ghost w-full py-1.5 text-xs">
            <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> Nowy portret
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div className="sheet-badge">
            <Shield size={16} className="text-gold" />
            <span className="font-display text-2xl font-extrabold tabular-nums">{ch.ac}</span>
            <span className="label !mb-0">KP</span>
          </div>
          <div className="sheet-badge">
            <HeartPulse size={16} className={ch.hp > 0 ? "text-felt" : "text-danger"} />
            <span className="font-display text-2xl font-extrabold tabular-nums">
              {ch.hp}
              <span className="text-sm text-muted">/{ch.max_hp}</span>
            </span>
            <span className="label !mb-0">PW</span>
          </div>
        </div>
        <HpBar hp={ch.hp} max={ch.max_hp} />
        {lifeState(ch) === "dying" && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-2.5 text-xs text-cream">
            <div className="mb-1.5 font-semibold text-danger">Walka o życie</div>
            <DeathPips successes={ch.death_successes} failures={ch.death_failures} />
            <p className="mt-1.5 leading-snug text-muted">3 sukcesy — przeżyje, 3 porażki — śmierć. Leczenie od razu ją ocuci.</p>
          </div>
        )}
        {ch.conditions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {ch.conditions.map((c) => (
              <span key={c} className="chip border-danger/40 text-danger">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Prawa kolumna */}
      <div className="min-w-0 space-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-tale text-3xl font-semibold leading-none text-cream">{ch.name}</h3>
            <span className="chip" style={{ color: cls.color, borderColor: `${cls.color}66` }}>
              <ClassIcon classId={cls.id} size={12} /> {cls.name}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted">
            {race.name} · poziom {ch.level} · biegłość {fmtMod(pb)} · kość wytrzymałości k{cls.hitDie}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <Avatar username={ch.username} size={16} /> gra {displayNameOf(ch.username)}
          </div>
        </div>

        {/* Cechy jako medaliony */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ABILITIES.map((a) => (
            <div key={a} className="ability-medal" title={ABILITY_PL[a].name}>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{ABILITY_PL[a].short}</span>
              <span className="font-display text-2xl font-extrabold tabular-nums text-cream">{fmtMod(mod(ch.scores[a]))}</span>
              <span className="ability-score">{ch.scores[a]}</span>
              {cls.saves.includes(a) && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-gold" title="Biegłość w rzucie obronnym" />}
            </div>
          ))}
        </div>

        {/* Doświadczenie */}
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Sparkles size={12} className="text-gold" /> Doświadczenie
            </span>
            <span className="font-mono">
              {ch.xp}
              {nextXp ? ` / ${nextXp} PD` : " PD"}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/30 ring-1 ring-line/60">
            <div
              className="h-full rounded-full bg-gold"
              style={{ width: `${nextXp ? Math.min(100, ((ch.xp - prevXp) / (nextXp - prevXp)) * 100) : 100}%` }}
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="label">Umiejętności</div>
            <ul className="grid grid-cols-1 gap-x-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
              {SKILL_NAMES.map((s) => {
                const prof = cls.skills.includes(s);
                return (
                  <li key={s} className={`flex items-center justify-between py-0.5 ${prof ? "text-cream" : "text-muted"}`}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${prof ? "bg-gold" : "border border-line"}`} />
                      {s} <span className="text-[10px] opacity-60">{ABILITY_PL[SKILLS[s]].short}</span>
                    </span>
                    <span className="font-mono text-xs">{fmtMod(checkModifier(ch, "check", SKILLS[s], s))}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="space-y-4">
            <div>
              <div className="label inline-flex items-center gap-1">
                <Backpack size={12} /> Ekwipunek
              </div>
              <ul className="space-y-1 text-sm">
                {ch.inventory.map((it, i) => (
                  <li key={i} className="rounded-lg border border-line/50 bg-panel2/40 px-2.5 py-1 text-cream">
                    {it}
                  </li>
                ))}
                {!ch.inventory.length && <li className="text-muted">Pusto…</li>}
              </ul>
            </div>
            {ch.look && (
              <div>
                <div className="label">Wygląd</div>
                <p className="font-tale text-[15px] leading-snug text-cream/90">{ch.look}</p>
              </div>
            )}
            {ch.backstory && (
              <div>
                <div className="label">Historia</div>
                <p className="whitespace-pre-line font-tale text-[15px] leading-snug text-cream/90">{ch.backstory}</p>
              </div>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex justify-end border-t border-line/60 pt-3">
            <button onClick={remove} className="btn-danger py-1.5 text-xs">
              <Trash2 size={13} /> Usuń postać
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
