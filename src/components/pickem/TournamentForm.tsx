"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import Modal from "@/components/Modal";
import { api } from "@/lib/client";
import type { LolLeague, LolTournament } from "@/lib/lolesports";

type Source = "manual" | "lolesports";

// Ligi z lolesports pobierane raz na sesję strony
let leaguesCache: LolLeague[] | null = null;

const editionLabel = (t: LolTournament) => `${t.slug.replace(/_/g, " ")} · ${t.startDate} – ${t.endDate}`;

function LolPicker({
  leagueId,
  setLeagueId,
  editionId,
  setEdition,
}: {
  leagueId: string;
  setLeagueId: (v: string) => void;
  editionId: string;
  setEdition: (t: LolTournament | null) => void;
}) {
  const [leagues, setLeagues] = useState<LolLeague[] | null>(leaguesCache);
  const [editions, setEditions] = useState<LolTournament[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (leaguesCache) return;
    api("/api/pickem/lolesports", "GET").then((res) => {
      if (!res.ok) return setError(res.error!);
      leaguesCache = res.data.leagues;
      setLeagues(leaguesCache);
    });
  }, []);

  useEffect(() => {
    setEditions(null);
    setEdition(null);
    if (!leagueId) return;
    api(`/api/pickem/lolesports?leagueId=${leagueId}`, "GET").then((res) => {
      if (!res.ok) return setError(res.error!);
      const list: LolTournament[] = res.data.tournaments;
      setEditions(list);
      // Domyślnie najnowsza edycja (lista jest od najnowszej)
      setEdition(list[0] ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  if (error) return <p className="text-sm text-danger">{error}</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label">Liga</label>
        <select className="input" value={leagueId} onChange={(e) => setLeagueId(e.target.value)} disabled={!leagues}>
          <option value="">{leagues ? "— wybierz ligę —" : "Wczytywanie…"}</option>
          {leagues?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.region.toLowerCase()})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Edycja</label>
        <select
          className="input"
          value={editionId}
          onChange={(e) => setEdition(editions?.find((t) => t.id === e.target.value) ?? null)}
          disabled={!editions?.length}
        >
          {!leagueId && <option value="">—</option>}
          {leagueId && !editions && <option value="">Wczytywanie…</option>}
          {editions?.length === 0 && <option value="">Brak edycji</option>}
          {editions?.map((t) => (
            <option key={t.id} value={t.id}>
              {editionLabel(t)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// Zakładanie turnieju (bez token) albo edycja nazwy i opisu istniejącego
export default function TournamentForm({
  token,
  initial,
}: {
  token?: string;
  initial?: { name: string; description: string | null };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState<Source>("manual");
  const [leagueId, setLeagueId] = useState("");
  const [edition, setEdition] = useState<LolTournament | null>(null);

  function show() {
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setSource("manual");
    setLeagueId("");
    setEdition(null);
    setError("");
    setOpen(true);
  }

  async function save() {
    setError("");
    const lol = !token && source === "lolesports";
    if (lol && !edition) return setError("Wybierz ligę i edycję");
    if (!lol && !name.trim()) return setError("Podaj nazwę turnieju");
    setSaving(true);
    const res = token
      ? await api(`/api/pickem/${token}`, "PATCH", { name, description })
      : await api("/api/pickem", "POST", {
          name,
          description,
          source: lol ? { league_id: leagueId, tournament_id: edition!.id } : null,
        });
    setSaving(false);
    if (!res.ok) return setError(res.error!);
    setOpen(false);
    if (!token) router.push(`/pickem/${res.data.token}`);
    router.refresh();
  }

  return (
    <>
      {token ? (
        <button className="btn-ghost" onClick={show}>
          <Pencil size={15} /> Edytuj
        </button>
      ) : (
        <button className="btn-primary" onClick={show}>
          <Plus size={16} /> Nowy turniej
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={token ? "Edytuj turniej" : "Nowy turniej"}>
        <div className="space-y-4">
          {!token && (
            <div>
              <label className="label">Skąd brać mecze</label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { v: "manual", t: "Ręcznie", d: "Dowolna gra — mecze i wyniki wpisuje admin" },
                    { v: "lolesports", t: "lolesports", d: "Ligi LoL — mecze, drużyny i wyniki pobierane same" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setSource(o.v)}
                    className={`rounded-xl border p-3 text-left transition ${
                      source === o.v ? "border-felt bg-felt/10" : "border-line hover:bg-panel2"
                    }`}
                  >
                    <span className={`block text-sm font-semibold ${source === o.v ? "text-felt" : ""}`}>{o.t}</span>
                    <span className="mt-0.5 block text-xs text-muted">{o.d}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!token && source === "lolesports" && (
            <LolPicker leagueId={leagueId} setLeagueId={setLeagueId} editionId={edition?.id ?? ""} setEdition={setEdition} />
          )}

          <div>
            <label className="label">Nazwa{!token && source === "lolesports" ? " (opcjonalnie)" : ""}</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={!token && source === "lolesports" ? "domyślnie z lolesports, np. Worlds 2026" : "np. Worlds 2026, Major CS2"}
            />
          </div>
          <div>
            <label className="label">Opis (opcjonalnie)</label>
            <textarea
              className="input min-h-20"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="np. Stawka: przegrany stawia pizzę"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              Anuluj
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? (source === "lolesports" && !token ? "Pobieranie meczów…" : "Zapisywanie…") : token ? "Zapisz" : "Utwórz"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
