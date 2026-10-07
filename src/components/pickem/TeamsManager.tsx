"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2, Users } from "lucide-react";
import Modal from "@/components/Modal";
import { api } from "@/lib/client";
import type { PickemTeam } from "@/lib/pickem";
import { TeamLogo } from "./parts";

function TeamRow({ token, team }: { token: string; team: PickemTeam }) {
  const router = useRouter();
  const [name, setName] = useState(team.name);
  const [short, setShort] = useState(team.short ?? "");
  const [logo, setLogo] = useState(team.logo_url ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = name !== team.name || short !== (team.short ?? "") || logo !== (team.logo_url ?? "");

  async function save() {
    setBusy(true);
    const res = await api(`/api/pickem/${token}/teams/${team.id}`, "PATCH", { name, short, logo_url: logo });
    setBusy(false);
    if (!res.ok) return setError(res.error!);
    setError("");
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Usunąć drużynę ${team.name}? Znikną też typy na nią i wyniki, w których wygrała.`)) return;
    setBusy(true);
    const res = await api(`/api/pickem/${token}/teams/${team.id}`, "DELETE");
    setBusy(false);
    if (!res.ok) return setError(res.error!);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-line/60 p-2">
      <div className="flex items-center gap-2">
        <TeamLogo team={{ ...team, name: name || team.name, short: short || null, logo_url: logo || null }} size={34} />
        <input className="input min-w-0 flex-1" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nazwa" />
        <input
          className="input w-20 flex-none font-mono uppercase"
          value={short}
          maxLength={8}
          onChange={(e) => setShort(e.target.value)}
          placeholder="TAG"
          aria-label="Skrót"
        />
        <button className="btn-ghost px-2.5" onClick={save} disabled={!dirty || busy} title="Zapisz" aria-label="Zapisz">
          <Check size={16} />
        </button>
        <button className="text-muted transition hover:text-danger" onClick={remove} disabled={busy} title="Usuń" aria-label="Usuń">
          <Trash2 size={16} />
        </button>
      </div>
      <input
        className="input mt-2 text-xs"
        value={logo}
        onChange={(e) => setLogo(e.target.value)}
        placeholder="Adres logo (opcjonalnie), https://…"
        aria-label="Logo"
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export default function TeamsManager({ token, teams }: { token: string; teams: PickemTeam[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bulk, setBulk] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Jedna drużyna w linii: „Nazwa | SKRÓT | adres logo” (skrót i logo opcjonalne)
  async function add() {
    const list = bulk
      .split("\n")
      .map((l) => l.split("|").map((x) => x.trim()))
      .filter((p) => p[0])
      .map(([name, short, logo_url]) => ({ name, short, logo_url }));
    if (!list.length) return setError("Wpisz przynajmniej jedną drużynę");
    setSaving(true);
    const res = await api(`/api/pickem/${token}/teams`, "POST", { teams: list });
    setSaving(false);
    if (!res.ok) return setError(res.error!);
    setBulk("");
    setError("");
    router.refresh();
  }

  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)}>
        <Users size={15} /> Drużyny ({teams.length})
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Drużyny turnieju" wide>
        <div className="space-y-5">
          <div>
            <label className="label">Dodaj drużyny</label>
            <textarea
              className="input min-h-28 font-mono text-xs"
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={"Jedna w linii: Nazwa | SKRÓT | logo (opcjonalnie)\nT1 | T1\nGen.G | GEN\nG2 Esports | G2 | https://…/g2.png"}
            />
            {error && <p className="mt-1 text-sm text-danger">{error}</p>}
            <div className="mt-2 flex justify-end">
              <button className="btn-primary" onClick={add} disabled={saving}>
                <Plus size={16} /> {saving ? "Dodawanie…" : "Dodaj"}
              </button>
            </div>
          </div>
          {teams.length > 0 && (
            <div className="space-y-2">
              <label className="label">Uczestnicy ({teams.length})</label>
              {teams.map((t) => (
                // key z danymi: po zapisie wiersz startuje od świeżych wartości z serwera
                <TeamRow key={`${t.id}:${t.name}:${t.short}:${t.logo_url}`} token={token} team={t} />
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
