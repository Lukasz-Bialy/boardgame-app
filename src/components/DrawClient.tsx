"use client";

import { useState, useRef } from "react";
import {
  Shuffle,
  Plus,
  X,
  Users,
  List,
  Settings2,
  RotateCcw,
  Trophy,
  Star,
  Swords,
} from "lucide-react";
import { Avatar } from "@/components/ui";

interface Player {
  username: string;
  displayName: string;
}

interface CustomResult {
  participant: Player;
  value: string;
}

type DrawResult =
  | { kind: "first"; player: Player; rerun: () => void }
  | { kind: "roles"; assignments: { player: Player; role: string }[]; unassigned: Player[]; rerun: () => void }
  | { kind: "custom"; results: CustomResult[]; rerun: () => void };

const ROLES = ["Top", "Mid", "Jungle", "Bottom", "Support"] as const;

const ROLE_COLORS: Record<string, string> = {
  Top: "#6C8CFF",
  Mid: "#B47CFF",
  Jungle: "#34A578",
  Bottom: "#E8B04B",
  Support: "#E5564B",
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function runCustomDraw(
  participants: Player[],
  values: string[],
  unique: boolean,
  balanced: boolean
): CustomResult[] {
  const shuffledParticipants = shuffle(participants);

  if (unique) {
    const shuffledValues = shuffle(values);
    return shuffledParticipants.map((p, i) => ({
      participant: p,
      value: shuffledValues[i % shuffledValues.length],
    }));
  }

  if (balanced) {
    const N = participants.length;
    const M = values.length;
    const base = Math.floor(N / M);
    const remainder = N % M;
    const shuffledValues = shuffle(values);
    const pool: string[] = [];
    for (let i = 0; i < M; i++) {
      const count = base + (i < remainder ? 1 : 0);
      for (let j = 0; j < count; j++) pool.push(shuffledValues[i]);
    }
    const shuffledPool = shuffle(pool);
    return shuffledParticipants.map((p, i) => ({
      participant: p,
      value: shuffledPool[i],
    }));
  }

  return shuffledParticipants.map((p) => ({
    participant: p,
    value: values[Math.floor(Math.random() * values.length)],
  }));
}

function valueCounts(results: CustomResult[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.value] = (counts[r.value] ?? 0) + 1;
  return counts;
}

// ─── Result panels ────────────────────────────────────────────────────────────

function FirstPlayerResult({ player, rerun }: { player: Player; rerun: () => void }) {
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-line px-5 py-3 flex items-center gap-2">
        <Star size={15} className="text-gold" />
        <span className="text-sm font-semibold text-cream">Pierwszy gracz</span>
        <button onClick={rerun} className="ml-auto btn-ghost py-1 px-2 text-xs gap-1.5">
          <RotateCcw size={13} /> Ponownie
        </button>
      </div>
      <div className="flex flex-col items-center gap-4 py-10 px-6">
        <Avatar username={player.username} size={72} />
        <div className="text-center">
          <div className="font-display text-2xl font-extrabold text-cream">{player.displayName}</div>
          <div className="text-sm text-muted mt-1">zaczyna jako pierwszy</div>
        </div>
      </div>
    </div>
  );
}

function RolesResult({
  assignments,
  unassigned,
  rerun,
}: {
  assignments: { player: Player; role: string }[];
  unassigned: Player[];
  rerun: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="panel overflow-hidden">
        <div className="border-b border-line px-5 py-3 flex items-center gap-2">
          <Swords size={15} className="text-felt" />
          <span className="text-sm font-semibold text-cream">Przydział ról</span>
          <button onClick={rerun} className="ml-auto btn-ghost py-1 px-2 text-xs gap-1.5">
            <RotateCcw size={13} /> Ponownie
          </button>
        </div>
        <ul className="divide-y divide-line">
          {assignments.map(({ player, role }) => (
            <li key={player.username} className="flex items-center gap-3 px-5 py-3">
              <span
                className="w-20 shrink-0 rounded-lg px-2 py-0.5 text-center text-xs font-bold"
                style={{
                  background: (ROLE_COLORS[role] ?? "#34A578") + "22",
                  color: ROLE_COLORS[role] ?? "#34A578",
                  border: `1px solid ${(ROLE_COLORS[role] ?? "#34A578")}44`,
                }}
              >
                {role}
              </span>
              <Avatar username={player.username} size={28} />
              <span className="text-sm font-medium text-cream">{player.displayName}</span>
            </li>
          ))}
        </ul>
      </div>
      {unassigned.length > 0 && (
        <div className="panel p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted mb-2">
            Bez roli ({unassigned.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((p) => (
              <div key={p.username} className="flex items-center gap-1.5 chip">
                <Avatar username={p.username} size={16} />
                <span>{p.displayName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CustomResult({
  results,
  rerun,
}: {
  results: CustomResult[];
  rerun: () => void;
}) {
  const counts = valueCounts(results);
  const sortedValues = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="panel overflow-hidden">
        <div className="border-b border-line px-5 py-3 flex items-center gap-2">
          <Trophy size={15} className="text-gold" />
          <span className="text-sm font-semibold text-cream">Wyniki losowania</span>
          <button onClick={rerun} className="ml-auto btn-ghost py-1 px-2 text-xs gap-1.5">
            <RotateCcw size={13} /> Ponownie
          </button>
        </div>
        <ul className="divide-y divide-line">
          {results.map((r, i) => (
            <li key={i} className="flex items-center gap-3 px-5 py-3">
              <Avatar username={r.participant.username} size={30} />
              <span className="text-sm font-medium text-cream">{r.participant.displayName}</span>
              <span className="ml-auto font-mono text-sm font-semibold text-felt">{r.value}</span>
            </li>
          ))}
        </ul>
      </div>
      {sortedValues.length > 1 && (
        <div className="panel p-4 space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted mb-3">
            Rozkład wartości
          </div>
          {sortedValues.map(([val, count]) => (
            <div key={val} className="flex items-center gap-3">
              <span className="text-sm text-cream min-w-0 flex-1 truncate">{val}</span>
              <div className="flex items-center gap-2">
                <div
                  className="h-2 rounded-full bg-felt/60"
                  style={{ width: `${Math.max(16, (count / results.length) * 120)}px` }}
                />
                <span className="text-xs font-mono text-muted w-6 text-right">{count}×</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DrawClient({ players }: { players: Player[] }) {
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(
    new Set(players.map((p) => p.username))
  );
  const [values, setValues] = useState<string[]>([]);
  const [valueInput, setValueInput] = useState("");
  const [unique, setUnique] = useState(false);
  const [balanced, setBalanced] = useState(false);
  const [result, setResult] = useState<DrawResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeParticipants = players.filter((p) => selectedPlayers.has(p.username));

  function togglePlayer(username: string) {
    setSelectedPlayers((prev) => {
      const next = new Set(prev);
      next.has(username) ? next.delete(username) : next.add(username);
      return next;
    });
  }

  function addValue() {
    const v = valueInput.trim();
    if (!v) return;
    setValues((prev) => [...prev, v]);
    setValueInput("");
    inputRef.current?.focus();
  }

  function removeValue(i: number) {
    setValues((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addValue();
    }
  }

  // Preset: pierwszy gracz
  function drawFirst() {
    if (activeParticipants.length === 0) return;
    const rerun = () => drawFirst();
    const player = shuffle(activeParticipants)[0];
    setResult({ kind: "first", player, rerun });
    setError(null);
  }

  // Preset: role
  function drawRoles() {
    if (activeParticipants.length === 0) return;
    const rerun = () => drawRoles();
    const shuffledPlayers = shuffle(activeParticipants);
    const shuffledRoles = shuffle([...ROLES]);
    const count = Math.min(shuffledPlayers.length, ROLES.length);
    const assignments = shuffledRoles.slice(0, count).map((role, i) => ({
      role,
      player: shuffledPlayers[i],
    }));
    const unassigned = shuffledPlayers.slice(count);
    setResult({ kind: "roles", assignments, unassigned, rerun });
    setError(null);
  }

  // Własne losowanie
  function drawCustom() {
    setError(null);
    if (activeParticipants.length === 0) {
      setError("Wybierz co najmniej jednego uczestnika.");
      return;
    }
    if (values.length === 0) {
      setError("Dodaj co najmniej jedną wartość do losowania.");
      return;
    }
    if (unique && values.length < activeParticipants.length) {
      setError(
        `Przy unikalnym losowaniu potrzebujesz co najmniej ${activeParticipants.length} wartości (masz ${values.length}).`
      );
      return;
    }
    const rerun = () => drawCustom();
    setResult({
      kind: "custom",
      results: runCustomDraw(activeParticipants, values, unique, balanced),
      rerun,
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Losowanie</h1>
        <p className="text-sm text-muted">Przydziel wartości uczestnikom losowo</p>
      </div>

      {/* ── Predefiniowane ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">
          Predefiniowane losowania
        </div>

        {/* Wybór uczestników (wspólny dla predefiniowanych) */}
        <div className="panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={15} className="text-felt" />
            <span className="text-sm font-semibold text-cream">Uczestnicy</span>
            <span className="ml-auto text-xs text-muted">
              {activeParticipants.length} / {players.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {players.map((p) => {
              const active = selectedPlayers.has(p.username);
              return (
                <button
                  key={p.username}
                  onClick={() => togglePlayer(p.username)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "border-felt/60 bg-felt/15 text-cream"
                      : "border-line bg-panel2 text-muted hover:border-felt/30 hover:text-cream"
                  }`}
                >
                  <Avatar username={p.username} size={22} />
                  {p.displayName}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_420px]">
          {/* Karty predefiniowanych */}
          <div className="grid gap-3 sm:grid-cols-2 content-start">
            {/* Pierwszy gracz */}
            <button
              onClick={drawFirst}
              disabled={activeParticipants.length === 0}
              className="panel group flex flex-col gap-3 p-5 text-left transition hover:border-gold/50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-panel2 transition group-hover:border-gold/40 group-hover:bg-gold/10">
                  <Star size={18} className="text-gold" />
                </span>
                <span className="text-sm font-semibold text-cream">Pierwszy gracz</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Losuje jedną osobę z wybranych uczestników, która zaczyna grę jako pierwsza.
              </p>
              <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-gold">
                <Shuffle size={13} /> Losuj
              </span>
            </button>

            {/* Role */}
            <button
              onClick={drawRoles}
              disabled={activeParticipants.length === 0}
              className="panel group flex flex-col gap-3 p-5 text-left transition hover:border-felt/50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-panel2 transition group-hover:border-felt/40 group-hover:bg-felt/10">
                  <Swords size={18} className="text-felt" />
                </span>
                <span className="text-sm font-semibold text-cream">Role w grze</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Losuje role{" "}
                {ROLES.map((r, i) => (
                  <span key={r}>
                    <span style={{ color: ROLE_COLORS[r] }} className="font-semibold">
                      {r}
                    </span>
                    {i < ROLES.length - 1 ? ", " : ""}
                  </span>
                ))}{" "}
                dla wybranych graczy.
              </p>
              <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-felt">
                <Shuffle size={13} /> Losuj
              </span>
            </button>
          </div>

          {/* Wyniki predefiniowanych + własnych */}
          <div>
            {result === null ? (
              <div className="panel flex h-full min-h-[160px] flex-col items-center justify-center gap-3 text-center p-8">
                <Shuffle size={36} className="text-muted" />
                <p className="text-muted text-sm">
                  Kliknij kafelek lub użyj własnego losowania poniżej
                </p>
              </div>
            ) : result.kind === "first" ? (
              <FirstPlayerResult player={result.player} rerun={result.rerun} />
            ) : result.kind === "roles" ? (
              <RolesResult
                assignments={result.assignments}
                unassigned={result.unassigned}
                rerun={result.rerun}
              />
            ) : (
              <CustomResult results={result.results} rerun={result.rerun} />
            )}
          </div>
        </div>
      </div>

      {/* ── Własne losowanie ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Własne losowanie
          </span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Wartości */}
          <div className="panel p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <List size={16} className="text-felt" />
              <span className="text-sm font-semibold text-cream">Wartości do losowania</span>
              <span className="ml-auto text-xs text-muted">{values.length} pozycji</span>
            </div>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                className="input flex-1"
                placeholder="Wpisz wartość i naciśnij Enter…"
                value={valueInput}
                onChange={(e) => setValueInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={addValue}
                disabled={!valueInput.trim()}
                className="btn-primary px-3"
                aria-label="Dodaj"
              >
                <Plus size={16} />
              </button>
            </div>
            {values.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {values.map((v, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-2.5 py-1 text-sm text-cream"
                  >
                    {v}
                    <button
                      onClick={() => removeValue(i)}
                      className="ml-0.5 rounded p-0.5 text-muted hover:text-danger transition"
                      aria-label={`Usuń ${v}`}
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Opcje */}
          <div className="panel p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Settings2 size={16} className="text-felt" />
              <span className="text-sm font-semibold text-cream">Opcje</span>
            </div>

            <label className="flex cursor-pointer items-start gap-3">
              <div className="relative mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={unique}
                  onChange={(e) => setUnique(e.target.checked)}
                />
                <div className="h-5 w-9 rounded-full border border-line bg-ink/60 transition peer-checked:border-felt/60 peer-checked:bg-felt/20" />
                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-muted transition peer-checked:translate-x-4 peer-checked:bg-felt" />
              </div>
              <div>
                <div className="text-sm font-medium text-cream">Unikalne losowanie</div>
                <div className="text-xs text-muted">
                  Każdy uczestnik dostaje inną wartość — żadna się nie powtarza.
                </div>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 ${unique ? "opacity-40 pointer-events-none" : ""}`}
            >
              <div className="relative mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={balanced && !unique}
                  onChange={(e) => setBalanced(e.target.checked)}
                  disabled={unique}
                />
                <div className="h-5 w-9 rounded-full border border-line bg-ink/60 transition peer-checked:border-felt/60 peer-checked:bg-felt/20" />
                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-muted transition peer-checked:translate-x-4 peer-checked:bg-felt" />
              </div>
              <div>
                <div className="text-sm font-medium text-cream">Równomierne rozłożenie</div>
                <div className="text-xs text-muted">
                  Każda wartość trafia do uczestników mniej więcej tyle samo razy.
                </div>
              </div>
            </label>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <button onClick={drawCustom} className="btn-primary w-full py-3 text-base">
          <Shuffle size={18} /> Losuj!
        </button>
      </div>
    </div>
  );
}
