"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Lock, LockOpen, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { Avatar } from "@/components/ui";
import { displayNameOf } from "@/lib/users";
import type { PollWithResults } from "@/lib/types";

export default function PollVoting({
  poll,
  shareUrl,
  canManage,
}: {
  poll: PollWithResults;
  shareUrl: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(poll.myVotes);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const isOpen = poll.is_open === 1;
  const maxVotes = Math.max(1, ...poll.options.map((o) => o.votes));

  function toggle(id: string) {
    if (!isOpen) return;
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function saveVote() {
    setError("");
    setSaving(true);
    const res = await api(`/api/polls/${poll.token}/vote`, "POST", { optionIds: selected });
    setSaving(false);
    if (!res.ok) return setError(res.error!);
    router.refresh();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Nie udało się skopiować linku");
    }
  }

  async function toggleOpen() {
    const res = await api(`/api/polls/${poll.token}`, "PATCH", { is_open: !isOpen });
    if (!res.ok) return setError(res.error!);
    router.refresh();
  }

  async function removePoll() {
    if (!confirm("Usunąć tę ankietę wraz z głosami?")) return;
    const res = await api(`/api/polls/${poll.token}`, "DELETE");
    if (!res.ok) return setError(res.error!);
    router.push("/polls");
    router.refresh();
  }

  const dirty =
    selected.length !== poll.myVotes.length ||
    selected.some((id) => !poll.myVotes.includes(id));

  return (
    <div className="space-y-6">
      {/* Link do udostępnienia */}
      <div className="panel flex flex-wrap items-center gap-3 p-4">
        <Link2 size={18} className="text-muted" />
        <code className="flex-1 truncate rounded-lg bg-panel2 px-3 py-2 text-sm text-muted">
          {shareUrl}
        </code>
        <button className="btn-ghost shrink-0" onClick={copyLink}>
          {copied ? (
            <>
              <Check size={16} /> Skopiowano
            </>
          ) : (
            <>
              <Link2 size={16} /> Kopiuj link
            </>
          )}
        </button>
      </div>

      {/* Opcje / głosowanie */}
      <div className="space-y-2">
        {poll.options.map((o) => {
          const picked = selected.includes(o.id);
          const pct = poll.totalVoters > 0 ? Math.round((o.votes / maxVotes) * 100) : 0;
          return (
            <button
              key={o.id}
              onClick={() => toggle(o.id)}
              disabled={!isOpen}
              className={`panel relative w-full overflow-hidden p-0 text-left transition ${
                isOpen ? "hover:border-felt/50" : "cursor-default opacity-90"
              } ${picked ? "border-felt" : ""}`}
            >
              {/* Pasek wyniku */}
              <div
                className="absolute inset-y-0 left-0 bg-felt/10 transition-all"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <div className="relative flex items-center gap-3 p-3.5">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    picked ? "border-felt bg-felt text-onaccent" : "border-line"
                  }`}
                >
                  {picked && <Check size={13} strokeWidth={3} />}
                </span>
                <span className="flex-1 font-medium">{o.label}</span>
                <span className="font-mono text-sm text-muted">
                  {o.votes} {o.votes === 1 ? "głos" : "głosów"}
                </span>
              </div>
              {o.voters.length > 0 && (
                <div className="relative flex flex-wrap items-center gap-1 px-3.5 pb-3">
                  {o.voters.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1 rounded-full bg-panel2 py-0.5 pl-0.5 pr-2 text-xs text-muted"
                    >
                      <Avatar username={v} size={16} /> {displayNameOf(v)}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {isOpen ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Możesz zaznaczyć kilka opcji.</p>
          <button className="btn-primary" onClick={saveVote} disabled={saving || !dirty}>
            {saving ? "Zapisywanie…" : dirty ? "Zapisz głos" : "Głos zapisany"}
          </button>
        </div>
      ) : (
        <p className="inline-flex items-center gap-2 text-sm text-muted">
          <Lock size={14} /> Ankieta zamknięta — głosowanie niedostępne.
        </p>
      )}

      {/* Zarządzanie (autor / admin) */}
      {canManage && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <button className="btn-ghost" onClick={toggleOpen}>
            {isOpen ? (
              <>
                <Lock size={16} /> Zamknij ankietę
              </>
            ) : (
              <>
                <LockOpen size={16} /> Otwórz ponownie
              </>
            )}
          </button>
          <button className="btn-danger" onClick={removePoll}>
            <Trash2 size={16} /> Usuń ankietę
          </button>
        </div>
      )}
    </div>
  );
}
