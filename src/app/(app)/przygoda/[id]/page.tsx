import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCampaign, listCharacters, listPosts, listRolls, roundProgress } from "@/lib/adventure/data";
import { isGmBusy } from "@/lib/adventure/gm";
import { imageProviderName } from "@/lib/adventure/images";
import AdventureClient from "@/components/adventure/AdventureClient";

export const dynamic = "force-dynamic";

export default async function AdventurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = (await getSession())!;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  const [characters, posts, rolls, busy] = await Promise.all([
    listCharacters(id),
    listPosts(id),
    listRolls(id, campaign.round),
    isGmBusy(id),
  ]);

  return (
    <AdventureClient
      campaign={campaign}
      characters={characters}
      posts={posts}
      rolls={rolls}
      progress={roundProgress(campaign, characters, posts, rolls)}
      me={session.username}
      isAdmin={session.role === "admin"}
      gmBusy={busy}
      gmConfigured={!!process.env.GEMINI_API_KEY}
      imagesEnabled={!!imageProviderName()}
    />
  );
}
