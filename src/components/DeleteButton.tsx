"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/client";

export default function DeleteButton({
  url,
  confirmText,
  redirectTo,
  label,
  iconOnly,
}: {
  url: string;
  confirmText: string;
  redirectTo?: string;
  label?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(confirmText)) return;
    setBusy(true);
    const res = await api(url, "DELETE");
    setBusy(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  if (iconOnly) {
    return (
      <button
        onClick={remove}
        disabled={busy}
        className="text-muted transition hover:text-danger"
        aria-label="Usuń"
        title="Usuń"
      >
        <Trash2 size={16} />
      </button>
    );
  }

  return (
    <button className="btn-danger" onClick={remove} disabled={busy}>
      <Trash2 size={16} /> {label ?? "Usuń"}
    </button>
  );
}
