import { db, q, run, uid } from "../db";

// Obrazki (sceny, mapy, portrety) generowane leniwie: przy tworzeniu zapisujemy tylko prompt,
// a pierwsze wyświetlenie (GET /api/przygoda/img/[id]) wywołuje dostawcę i zapisuje plik w bazie.
// Dostawcy w kolejności — użyty zostanie pierwszy skonfigurowany:
//   1. Cloudflare Workers AI (CF_ACCOUNT_ID + CF_API_TOKEN) — darmowy dzienny limit, FLUX schnell
//   2. Pollinations (POLLINATIONS_KEY, klucz sk_ z enter.pollinations.ai)
//   3. Gemini (GEMINI_IMAGE_MODEL, np. gemini-2.5-flash-image — zwykle wymaga płatnego planu)
// Bez żadnego dostawcy UI pokazuje proceduralne grafiki zastępcze.

export type ImageKind = "scene" | "map" | "portrait";

const STYLE: Record<ImageKind, string> = {
  scene:
    "fantasy tabletop RPG illustration, painterly digital art, cinematic composition, dramatic lighting, rich colors, highly detailed, no text, no letters, no watermark",
  map:
    "top-down fantasy map, hand-drawn ink and watercolor on aged parchment, cartography style, compass rose, detailed terrain, no text, no labels, no letters",
  portrait:
    "fantasy character portrait, head and shoulders, painterly digital art, dramatic rim lighting, dark moody background, detailed face, no text, no watermark",
};

const SIZE: Record<ImageKind, { w: number; h: number }> = {
  scene: { w: 1024, h: 576 },
  map: { w: 1024, h: 768 },
  portrait: { w: 640, h: 800 },
};

export function imageProviderName(): string | null {
  if (process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN) return "cloudflare";
  if (process.env.POLLINATIONS_KEY) return "pollinations";
  if (process.env.GEMINI_IMAGE_MODEL && process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

export async function createImage(kind: ImageKind, prompt: string): Promise<string | null> {
  if (!prompt.trim() || !imageProviderName()) return null;
  const id = uid();
  await run(`INSERT INTO adv_images (id, kind, prompt, status, created_at) VALUES (?, ?, ?, 'pending', ?)`, [
    id,
    kind,
    prompt.trim().slice(0, 800),
    new Date().toISOString(),
  ]);
  return id;
}

type Img = { bytes: Uint8Array; mime: string };

async function viaCloudflare(prompt: string): Promise<Img> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, steps: 6 }),
    }
  );
  if (!res.ok) throw new Error(`Cloudflare ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const b64 = json?.result?.image;
  if (!b64) throw new Error("Cloudflare: brak obrazka w odpowiedzi");
  return { bytes: Buffer.from(b64, "base64"), mime: "image/jpeg" };
}

async function viaPollinations(prompt: string, kind: ImageKind): Promise<Img> {
  const { w, h } = SIZE[kind];
  const seed = Math.floor(Math.random() * 1e9);
  const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&model=flux&nologo=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.POLLINATIONS_KEY}` } });
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);
  return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get("content-type") ?? "image/jpeg" };
}

async function viaGemini(prompt: string, kind: ImageKind): Promise<Img> {
  const aspect = kind === "portrait" ? "4:5" : kind === "map" ? "4:3" : "16:9";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_IMAGE_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `Generate an image (aspect ratio ${aspect}): ${prompt}` }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini image ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const part = json?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
  if (!part) throw new Error("Gemini: brak obrazka w odpowiedzi");
  return { bytes: Buffer.from(part.inlineData.data, "base64"), mime: part.inlineData.mimeType ?? "image/png" };
}

async function generate(kind: ImageKind, prompt: string): Promise<Img> {
  const full = `${prompt}. ${STYLE[kind]}`;
  switch (imageProviderName()) {
    case "cloudflare":
      return viaCloudflare(full);
    case "pollinations":
      return viaPollinations(full, kind);
    case "gemini":
      return viaGemini(full, kind);
    default:
      throw new Error("Brak dostawcy obrazków");
  }
}

export type ImageFetch =
  | { state: "ready"; bytes: Uint8Array; mime: string }
  | { state: "busy" }
  | { state: "missing" | "failed" };

const STALE_MS = 90_000;

export async function getOrGenerateImage(id: string): Promise<ImageFetch> {
  const [row] = await q<{ kind: ImageKind; prompt: string; status: string; mime: string | null; data: ArrayBuffer | null }>(
    `SELECT kind, prompt, status, mime, data FROM adv_images WHERE id = ?`,
    [id]
  );
  if (!row) return { state: "missing" };
  if (row.status === "ready" && row.data) return { state: "ready", bytes: new Uint8Array(row.data), mime: row.mime ?? "image/jpeg" };
  if (row.status === "failed") return { state: "failed" };

  // Zajmij generowanie atomowo, żeby dwóch oglądających nie zamówiło tego samego obrazka dwa razy
  const now = new Date();
  const claim = await db.execute({
    sql: `UPDATE adv_images SET status = 'generating', started_at = ?
          WHERE id = ? AND (status = 'pending' OR (status = 'generating' AND started_at < ?))`,
    args: [now.toISOString(), id, new Date(now.getTime() - STALE_MS).toISOString()],
  });
  if (claim.rowsAffected === 0) return { state: "busy" };

  try {
    const img = await generate(row.kind, row.prompt);
    await run(`UPDATE adv_images SET status = 'ready', mime = ?, data = ? WHERE id = ?`, [img.mime, img.bytes, id]);
    return { state: "ready", ...img };
  } catch (e) {
    console.error("Generowanie obrazka nie powiodło się:", e);
    // Limit dostawcy bywa chwilowy — UI pokazuje grafikę zastępczą z przyciskiem „spróbuj ponownie” (retryImage)
    await run(`UPDATE adv_images SET status = 'failed' WHERE id = ?`, [id]);
    return { state: "failed" };
  }
}

export async function retryImage(id: string): Promise<void> {
  await run(`UPDATE adv_images SET status = 'pending', started_at = NULL WHERE id = ? AND status = 'failed'`, [id]);
}
