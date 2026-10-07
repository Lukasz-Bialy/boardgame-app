"use client";

import { forwardRef, useState } from "react";
import { useRouter } from "next/navigation";

// Formularz logowania — używany w wysuwanym panelu na stronie startowej (LoginPopover).
const LoginForm = forwardRef<HTMLInputElement, { from?: string | null }>(function LoginForm({ from }, firstInputRef) {
  const router = useRouter();
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
    if (!res.ok) {
      setLoading(false);
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Nie udało się zalogować");
      return;
    }
    // Tylko ścieżki wewnątrz aplikacji — bez przekierowań na obce adresy
    const target = from && from.startsWith("/") && !from.startsWith("//") ? from : "/dashboard";
    router.push(target);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="login-username">Login</label>
        <input
          id="login-username"
          ref={firstInputRef}
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Twój login"
          autoComplete="username"
        />
      </div>
      <div>
        <label className="label" htmlFor="login-password">Hasło</label>
        <input
          id="login-password"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <button className="btn-primary w-full py-2.5" disabled={loading}>
        {loading ? "Logowanie…" : "Zaloguj się"}
      </button>
    </form>
  );
});

export default LoginForm;
