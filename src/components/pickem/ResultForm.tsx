"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import Modal from "@/components/Modal";
import { api } from "@/lib/client";
import type { PickemMatch, PickemTeam } from "@/lib/pickem";
import { TeamLogo } from "./parts";

export default function ResultForm({
  token,
  match,
  teams,
  onClose,
}: {
  token: string;
  match: PickemMatch;
  teams: Map<string, PickemTeam>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [winner, setWinner] = useState(match.winner_id ?? "");
  const [scoreA, setScoreA] = useState(match.score_a?.toString() ?? "");
  const [scoreB, setScoreB] = useState(match.score_b?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const need = Math.ceil(match.best_of / 2);

  // Wpisany wynik serii sam wskazuje zwycięzcę
  function setScore(side: "a" | "b", v: string) {
    const na = side === "a" ? v : scoreA;
    const nb = side === "b" ? v : scoreB;
    if (side === "a") setScoreA(v);
    else setScoreB(v);
    if (Number(na) === need && Number(nb) < need) setWinner(match.a!);
    if (Number(nb) === need && Number(na) < need) setWinner(match.b!);
  }

  async function save() {
    if (!winner) return setError("Wybierz zwycięzcę");
    setSaving(true);
    const res = await api(`/api/pickem/${token}/matches/${match.id}/result`, "PUT", {
      winner_id: winner,
      score_a: scoreA,
      score_b: scoreB,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error!);
    onClose();
    router.refresh();
  }

  async function clear() {
    setSaving(true);
    const res = await api(`/api/pickem/${token}/matches/${match.id}/result`, "DELETE");
    setSaving(false);
    if (!res.ok) return setError(res.error!);
    onClose();
    router.refresh();
  }

  const side = (id: string, score: string, onScore: (v: string) => void) => {
    const t = teams.get(id);
    const on = winner === id;
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => setWinner(id)}
          className={`flex w-full flex-col items-center gap-2 rounded-xl border p-4 transition ${
            on ? "border-gold bg-gold/10" : "border-line hover:bg-panel2"
          }`}
        >
          <TeamLogo team={t} size={44} />
          <span className="text-center text-sm font-semibold">{t?.name}</span>
          <span className={`inline-flex items-center gap-1 text-xs ${on ? "text-gold" : "invisible"}`}>
            <Trophy size={12} /> zwycięzca
          </span>
        </button>
        {match.best_of > 1 && (
          <input
            type="number"
            min={0}
            max={need}
            value={score}
            onChange={(e) => onScore(e.target.value)}
            className="input w-20 text-center font-mono text-lg"
            aria-label={`Wygrane mapy: ${t?.name}`}
          />
        )}
      </div>
    );
  };

  return (
    <Modal open onClose={onClose} title="Wynik meczu">
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
          {side(match.a!, scoreA, (v) => setScore("a", v))}
          <span className="pt-10 font-display text-sm font-bold text-muted">vs</span>
          {side(match.b!, scoreB, (v) => setScore("b", v))}
        </div>
        {match.best_of > 1 && <p className="text-center text-xs text-muted">Wynik serii Bo{match.best_of} jest opcjonalny</p>}
        {match.ext && !match.locked && (
          <p className="rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold">
            Wynik ustawiony ręcznie wyłącza ten mecz z synchronizacji z lolesports. Włączysz ją z powrotem w edycji meczu.
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          {match.winner_id ? (
            <button className="btn-danger" onClick={clear} disabled={saving}>
              Usuń wynik
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose}>
              Anuluj
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Zapisywanie…" : "Zapisz wynik"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
