"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { api } from "@/lib/client";
import type { PickemMatch, PickemTeam, SlotInput } from "@/lib/pickem";
import { isoToWarsawInput, warsawInputToIso } from "@/lib/pickem-time";
import { matchTitle } from "./parts";

type SlotMode = "team" | "winner" | "loser" | "tbd";
type SlotState = { mode: SlotMode; team: string; match: string };

const toState = (s: SlotInput | undefined): SlotState =>
  !s
    ? { mode: "tbd", team: "", match: "" }
    : "team_id" in s
      ? { mode: "team", team: s.team_id, match: "" }
      : { mode: s.kind, team: "", match: s.match_id };

const toSlot = (s: SlotState): SlotInput =>
  s.mode === "team" && s.team
    ? { team_id: s.team }
    : (s.mode === "winner" || s.mode === "loser") && s.match
      ? { match_id: s.match, kind: s.mode }
      : null;

function SlotPicker({
  label,
  value,
  onChange,
  teams,
  sources,
  teamMap,
}: {
  label: string;
  value: SlotState;
  onChange: (v: SlotState) => void;
  teams: PickemTeam[];
  sources: PickemMatch[];
  teamMap: Map<string, PickemTeam>;
}) {
  const modes: { v: SlotMode; l: string }[] = [
    { v: "team", l: "Drużyna" },
    { v: "winner", l: "Zwycięzca meczu" },
    { v: "loser", l: "Przegrany meczu" },
    { v: "tbd", l: "Do ustalenia" },
  ];
  return (
    <div className="rounded-xl border border-line/70 bg-panel2/40 p-3">
      <label className="label">{label}</label>
      <div className="mb-2 flex flex-wrap gap-1">
        {modes.map((m) => (
          <button
            key={m.v}
            type="button"
            onClick={() => onChange({ ...value, mode: m.v })}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              value.mode === m.v ? "bg-felt text-onaccent" : "text-muted hover:bg-panel2 hover:text-cream"
            }`}
          >
            {m.l}
          </button>
        ))}
      </div>
      {value.mode === "team" && (
        <select className="input" value={value.team} onChange={(e) => onChange({ ...value, team: e.target.value })}>
          <option value="">— wybierz drużynę —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.short ? ` (${t.short})` : ""}
            </option>
          ))}
        </select>
      )}
      {(value.mode === "winner" || value.mode === "loser") &&
        (sources.length ? (
          <select className="input" value={value.match} onChange={(e) => onChange({ ...value, match: e.target.value })}>
            <option value="">— wybierz mecz —</option>
            {sources.map((m) => (
              <option key={m.id} value={m.id}>
                {matchTitle(m, teamMap)}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-muted">Najpierw dodaj mecz, z którego ma przejść drużyna.</p>
        ))}
      {value.mode === "tbd" && (
        <p className="text-xs text-muted">Uzupełnisz później w edycji meczu — do tego czasu nie da się go typować.</p>
      )}
    </div>
  );
}

export default function MatchForm({
  token,
  match,
  matches,
  teams,
  open,
  onClose,
}: {
  token: string;
  match: PickemMatch | null; // null = nowy mecz
  matches: PickemMatch[];
  teams: PickemTeam[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const last = matches[matches.length - 1];

  const [stage, setStage] = useState(match?.stage ?? last?.stage ?? "");
  const [label, setLabel] = useState(match?.label ?? "");
  const [startsAt, setStartsAt] = useState(match ? isoToWarsawInput(match.starts_at) : "");
  const [bestOf, setBestOf] = useState(match?.best_of ?? last?.best_of ?? 1);
  const [points, setPoints] = useState(match?.points ?? last?.points ?? 1);
  // Nowy mecz dziedziczy tryb po ostatnim (zwykle ten sam etap)
  const [exact, setExact] = useState(match ? match.exact : !!last?.exact);
  const [a, setA] = useState<SlotState>(toState(match?.slotA ?? { team_id: "" }));
  const [b, setB] = useState<SlotState>(toState(match?.slotB ?? { team_id: "" }));
  // Mecz z lolesports: zmiana pól, które nadpisuje synchronizacja, sama ją wyłącza
  const [sync, setSync] = useState(!match?.locked);
  const touched = () => match?.ext && setSync(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stages = [...new Set(matches.map((m) => m.stage).filter(Boolean))] as string[];
  // Źródłem może być każdy inny mecz (pętle w drabince odrzuca serwer)
  const sources = matches.filter((m) => m.id !== match?.id);

  async function save() {
    setError("");
    const iso = warsawInputToIso(startsAt);
    if (!iso) return setError("Podaj datę i godzinę meczu");
    setSaving(true);
    const body = { stage, label, starts_at: iso, best_of: bestOf, points, exact: exact && bestOf > 1, a: toSlot(a), b: toSlot(b), sync };
    const res = match
      ? await api(`/api/pickem/${token}/matches/${match.id}`, "PATCH", body)
      : await api(`/api/pickem/${token}/matches`, "POST", body);
    setSaving(false);
    if (!res.ok) return setError(res.error!);
    onClose();
    router.refresh();
  }

  return (
    <Modal open={open} onClose={onClose} title={match ? "Edytuj mecz" : "Nowy mecz"} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Etap</label>
            <input
              className="input"
              list="pickem-stages"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              placeholder="np. Swiss — runda 1, Ćwierćfinały"
            />
            <datalist id="pickem-stages">
              {stages.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">Nazwa meczu (opcjonalnie)</label>
            <input
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="np. Ćwierćfinał 1 — przyda się w drabince"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Start (czas polski)</label>
            <input
              type="datetime-local"
              className="input"
              value={startsAt}
              onChange={(e) => {
                setStartsAt(e.target.value);
                touched();
              }}
            />
          </div>
          <div>
            <label className="label">Format</label>
            <div className="flex gap-1">
              {[1, 3, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setBestOf(n);
                    touched();
                  }}
                  className={`flex-1 rounded-xl border px-2 py-2 text-sm font-semibold transition ${
                    bestOf === n ? "border-felt bg-felt/15 text-felt" : "border-line text-muted hover:text-cream"
                  }`}
                >
                  Bo{n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Punkty za trafienie</label>
            <input
              type="number"
              min={1}
              max={100}
              className="input"
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="label">Typowanie</label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { v: false, t: "Zwycięzca", d: "Gracze wskazują, kto wygra" },
                { v: true, t: "Dokładny wynik", d: "Gracze typują wynik serii, np. 2:1 — trafiony wynik daje bonus" },
              ] as const
            ).map((o) => {
              const on = (exact && bestOf > 1) === o.v;
              const off = o.v && bestOf === 1;
              return (
                <button
                  key={String(o.v)}
                  type="button"
                  disabled={off}
                  onClick={() => setExact(o.v)}
                  className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    on ? "border-felt bg-felt/10" : "border-line hover:bg-panel2"
                  }`}
                >
                  <span className={`block text-sm font-semibold ${on ? "text-felt" : ""}`}>{o.t}</span>
                  <span className="mt-0.5 block text-xs text-muted">{off ? "Niedostępne w Bo1 — wynik jest zawsze 1:0" : o.d}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {(["A", "B"] as const).map((s) => (
            <SlotPicker
              key={s}
              label={`Strona ${s}`}
              value={s === "A" ? a : b}
              onChange={(v) => {
                (s === "A" ? setA : setB)(v);
                touched();
              }}
              teams={teams}
              sources={sources}
              teamMap={teamMap}
            />
          ))}
        </div>
        {teams.length === 0 && (
          <p className="text-sm text-gold">Turniej nie ma jeszcze drużyn — dodaj je przyciskiem „Drużyny”.</p>
        )}

        {match?.ext && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line/70 bg-panel2/40 p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[rgb(var(--c-felt))]"
              checked={sync}
              onChange={(e) => setSync(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-semibold">Aktualizuj z lolesports</span>
              <span className="mt-0.5 block text-xs text-muted">
                {sync
                  ? "Drużyny, godzina, format i wynik będą nadpisywane danymi z API."
                  : "Mecz zostaje tak, jak go ustawisz — synchronizacja go pominie. Nazwy, etapu i punktów API i tak nie zmienia."}
              </span>
            </span>
          </label>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Zapisywanie…" : match ? "Zapisz" : "Dodaj mecz"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
