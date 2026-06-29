"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Nie udało się zalogować");
      return;
    }
    const from = params.get("from") || "/dashboard";
    router.push(from);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="panel space-y-4 p-6">
      <div>
        <label className="label">Login</label>
        <input
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="np. Bulczy"
          autoComplete="username"
          autoFocus
        />
      </div>
      <div>
        <label className="label">Hasło</label>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "Logowanie…" : "Zaloguj się"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={48} />
          <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight">Wieczór gier</h1>
          <p className="mt-1 text-sm text-muted">Zaloguj się, żeby wejść do klubu</p>
        </div>

        <Suspense fallback={<div className="panel p-6 text-center text-muted">Ładowanie…</div>}>
          <LoginForm />
        </Suspense>

        <p className="mt-4 text-center text-xs text-muted">
          Konta: Bulczy · Chleboldi · Eldorida · Vrenshrrgn · Entey
        </p>
      </div>
    </main>
  );
}
