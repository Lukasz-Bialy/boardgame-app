"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse, Shield, Sparkles } from "lucide-react";
import { ClassIcon } from "./art";
import { api } from "@/lib/client";
import {
  ABILITIES,
  ABILITY_PL,
  CLASSES,
  RACES,
  STANDARD_ARRAY,
  applyRace,
  armorClass,
  defaultScores,
  fmtMod,
  mod,
  startingHp,
  type Ability,
  type Scores,
} from "@/lib/adventure/rules";

const ABILITY_HINT: Record<Ability, string> = {
  STR: "walka wręcz, dźwiganie, wspinaczka",
  DEX: "uniki, łuki, skradanie, pancerz lekki",
  CON: "punkty życia, wytrzymałość",
  INT: "magia czarodzieja, wiedza, śledztwo",
  WIS: "percepcja, intuicja, magia kapłana i druida",
  CHA: "rozmowy, blef, magia barda i czarnoksiężnika",
};

export default function CharacterCreator({ campaignId, onDone }: { campaignId: string; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [raceId, setRaceId] = useState(RACES[0].id);
  const [classId, setClassId] = useState(CLASSES[0].id);
  const [base, setBase] = useState<Scores>(defaultScores(CLASSES[0]));
  const [look, setLook] = useState("");
  const [backstory, setBackstory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const race = RACES.find((r) => r.id === raceId)!;
  const cls = CLASSES.find((c) => c.id === classId)!;
  const scores = useMemo(() => applyRace(base, race), [base, race]);

  function pickClass(id: string) {
    setClassId(id);
    // Nowa klasa = rozkład cech pod nią (gracz może potem zamienić)
    setBase(defaultScores(CLASSES.find((c) => c.id === id)!));
  }

  // Wybór wartości już użytej przez inną cechę zamienia je miejscami — zawsze zostaje pełny zestaw
  function setScore(a: Ability, v: number) {
    const other = ABILITIES.find((x) => x !== a && base[x] === v);
    setBase((b) => ({ ...b, [a]: v, ...(other ? { [other]: b[a] } : {}) }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await api(`/api/przygoda/${campaignId}/characters`, "POST", {
      name,
      race_id: raceId,
      class_id: classId,
      base,
      look,
      backstory,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error ?? "Nie udało się");
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <p className="rounded-xl border border-gold/30 bg-gold/[0.07] p-3 text-sm text-cream/90">
        Postać to Twój bohater w opowieści. <b>Rasa</b> daje premie do cech, <b>klasa</b> określa, w czym jest dobra
        (walka, magia, skradanie…). Liczby możesz zostawić domyślne, są już dobrane pod klasę.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Imię postaci</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Thorin Kamiennoręki" maxLength={60} required />
        </div>
        <div>
          <label className="label">Wygląd (do portretu)</label>
          <input
            className="input"
            value={look}
            onChange={(e) => setLook(e.target.value)}
            placeholder="np. rude włosy, blizna na policzku, czerwony płaszcz"
            maxLength={300}
          />
        </div>
      </div>

      <div>
        <div className="label">Rasa</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {RACES.map((r) => (
            <button
              type="button"
              key={r.id}
              onClick={() => setRaceId(r.id)}
              className={`flex flex-col items-start justify-start rounded-xl border p-2.5 text-left transition ${
                r.id === raceId ? "border-gold/70 bg-gold/10" : "border-line/70 bg-panel2/30 hover:border-line hover:bg-panel2"
              }`}
            >
              <div className="font-tale text-base font-semibold text-cream">{r.name}</div>
              <div className="text-[11px] font-semibold text-gold">
                {Object.entries(r.bonus)
                  .map(([a, v]) => `${ABILITY_PL[a as Ability].short} +${v}`)
                  .join(" · ")}
              </div>
              <div className="mt-0.5 text-[11px] leading-tight text-muted">{r.blurb}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="label">Klasa</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {CLASSES.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => pickClass(c.id)}
              className={`class-card flex flex-col items-start justify-start rounded-xl border p-2.5 text-left transition ${
                c.id === classId ? "bg-panel2" : "border-line/70 bg-panel2/30 hover:bg-panel2"
              }`}
              style={c.id === classId ? { borderColor: c.color, boxShadow: `0 0 0 1px ${c.color}55 inset` } : undefined}
            >
              <span
                className="mb-1.5 inline-flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: `${c.color}26`, color: c.color }}
              >
                <ClassIcon classId={c.id} size={17} />
              </span>
              <div className="font-tale text-base font-semibold leading-tight text-cream">{c.name}</div>
              <div className="mt-0.5 text-[11px] leading-tight text-muted">{c.blurb}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <div>
          <div className="label">Cechy (zestaw 15 · 14 · 13 · 12 · 10 · 8 + premia rasy)</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {ABILITIES.map((a) => (
              <div key={a} className="flex items-center gap-2 rounded-xl border border-line/60 bg-panel2/30 px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-cream">{ABILITY_PL[a].name}</div>
                  <div className="truncate text-[11px] text-muted">{ABILITY_HINT[a]}</div>
                </div>
                <select
                  className="input !w-16 !px-2 !py-1"
                  value={base[a]}
                  onChange={(e) => setScore(a, Number(e.target.value))}
                  aria-label={ABILITY_PL[a].name}
                >
                  {STANDARD_ARRAY.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <div className="w-14 text-right">
                  <div className="font-mono text-sm font-bold text-cream">{scores[a]}</div>
                  <div className="font-mono text-[11px] text-gold">{fmtMod(mod(scores[a]))}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-line/70 bg-panel2/40 p-3">
          <div className="label">Podgląd</div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-muted">
                <HeartPulse size={14} className="text-felt" /> Punkty życia
              </span>
              <span className="font-display text-xl font-extrabold">{startingHp(cls, scores)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-muted">
                <Shield size={14} className="text-gold" /> Klasa pancerza
              </span>
              <span className="font-display text-xl font-extrabold">{armorClass(cls, scores)}</span>
            </div>
            <div>
              <div className="mb-1 inline-flex items-center gap-1.5 text-muted">
                <Sparkles size={14} className="text-gold" /> Biegłości
              </div>
              <div className="flex flex-wrap gap-1">
                {cls.skills.map((s) => (
                  <span key={s} className="chip !px-2 !py-0.5 text-[11px]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-[11px] leading-snug text-muted">Start: {cls.inventory.slice(0, 3).join(", ")}…</div>
          </div>
        </div>
      </div>

      <div>
        <label className="label">Historia postaci (opcjonalnie)</label>
        <textarea
          className="input min-h-[80px]"
          value={backstory}
          onChange={(e) => setBackstory(e.target.value)}
          placeholder="Skąd pochodzi, czego szuka, czego się boi? Mistrz Gry wykorzysta to w opowieści."
          maxLength={1500}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end">
        <button className="btn-primary" disabled={saving || !name.trim()}>
          {saving ? "Tworzenie…" : "Stwórz postać"}
        </button>
      </div>
    </form>
  );
}
