"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { api } from "@/lib/client";

const MIN_LENGTH = 6;

export default function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  function close() {
    setCurrent("");
    setNext("");
    setRepeat("");
    setError("");
    setDone(false);
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next.length < MIN_LENGTH) return setError(`Nowe hasło musi mieć co najmniej ${MIN_LENGTH} znaków`);
    if (next !== repeat) return setError("Nowe hasła nie są takie same");
    setLoading(true);
    const res = await api("/api/auth/password", "POST", { currentPassword: current, newPassword: next });
    setLoading(false);
    if (!res.ok) return setError(res.error ?? "Nie udało się zmienić hasła");
    setDone(true);
  }

  return (
    <Modal open={open} onClose={close} title="Zmień hasło">
      {done ? (
        <div className="space-y-4">
          <p className="rounded-lg border border-felt/40 bg-felt/10 px-3 py-2 text-sm text-felt">
            Hasło zostało zmienione. Przy następnym logowaniu użyj nowego.
          </p>
          <button className="btn-primary w-full" onClick={close}>
            Gotowe
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Obecne hasło</label>
            <input
              type="password"
              className="input"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Nowe hasło</label>
            <input
              type="password"
              className="input"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label">Powtórz nowe hasło</label>
            <input
              type="password"
              className="input"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button className="btn-primary w-full" disabled={loading || !current || !next || !repeat}>
            {loading ? "Zapisywanie…" : "Zmień hasło"}
          </button>
        </form>
      )}
    </Modal>
  );
}
