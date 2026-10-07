import { NextResponse } from "next/server";
import { withAuth, ok } from "@/lib/api";
import { getOrGenerateImage, retryImage } from "@/lib/adventure/images";

// Generowanie obrazka trwa kilka–kilkanaście sekund
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ imgId: string }> }) {
  const { imgId } = await params;
  return withAuth(async () => {
    const img = await getOrGenerateImage(imgId);
    if (img.state === "ready") {
      return new NextResponse(Buffer.from(img.bytes), {
        headers: { "Content-Type": img.mime, "Cache-Control": "private, max-age=31536000, immutable" },
      });
    }
    // 503 + Retry-After: ktoś inny właśnie generuje — komponent spróbuje ponownie
    if (img.state === "busy") return new NextResponse(null, { status: 503, headers: { "Retry-After": "4" } });
    return new NextResponse(null, { status: img.state === "failed" ? 422 : 404 });
  });
}

// Ponowna próba po nieudanym generowaniu
export async function POST(_req: Request, { params }: { params: Promise<{ imgId: string }> }) {
  const { imgId } = await params;
  return withAuth(async () => {
    await retryImage(imgId);
    return ok();
  });
}
