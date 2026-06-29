"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { api } from "@/lib/client";

export default function RatingWidget({
  gameId,
  myRating,
}: {
  gameId: string;
  myRating: number | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(myRating);
  const [hover, setHover] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function rate(score: number) {
    setValue(score);
    setSaving(true);
    const res = await api(`/api/games/${gameId}/rating`, "PUT", { score });
    setSaving(false);
    if (res.ok) router.refresh();
  }

  const shown = hover ?? value ?? 0;

  return (
    <div>
      <div className="label">Twoja ocena</div>
      <div className="flex items-center gap-1.5" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            disabled={saving}
            onMouseEnter={() => setHover(n)}
            onClick={() => rate(n)}
            className="transition hover:scale-110"
            aria-label={`Oceń na ${n}`}
          >
            <Star
              size={22}
              className={n <= shown ? "text-gold" : "text-line"}
              fill={n <= shown ? "currentColor" : "none"}
            />
          </button>
        ))}
        <span className="ml-2 font-mono text-sm text-muted">
          {value ? `${value}/10` : "—"}
        </span>
      </div>
    </div>
  );
}
