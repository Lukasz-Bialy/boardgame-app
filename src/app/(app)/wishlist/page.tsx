import { Gift, ExternalLink, StickyNote } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listWishlist } from "@/lib/data-misc";
import { formatDate, Avatar } from "@/components/ui";
import { displayNameOf } from "@/lib/users";
import WishlistForm from "@/components/WishlistForm";
import DeleteButton from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const session = (await getSession())!;
  const items = await listWishlist();
  const isAdmin = session.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Wishlista</h1>
          <p className="text-sm text-muted">
            Gry, które fajnie byłoby kupić · {items.length}{" "}
            {items.length === 1 ? "pozycja" : "pozycji"}
          </p>
        </div>
        <WishlistForm />
      </div>

      {items.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 p-12 text-center">
          <Gift size={40} className="text-muted" />
          <p className="text-muted">Wishlista jest pusta. Dorzućcie wymarzone tytuły.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((it) => {
            const canDelete = isAdmin || it.added_by === session.username;
            return (
              <div key={it.id} className="panel overflow-hidden">
                <div className="relative aspect-[16/10] bg-panel2">
                  {it.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted">
                      <Gift size={36} />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-lg font-bold leading-tight">{it.name}</h3>
                    {canDelete && (
                      <DeleteButton
                        url={`/api/wishlist/${it.id}`}
                        confirmText={`Usunąć „${it.name}" z wishlisty?`}
                        iconOnly
                      />
                    )}
                  </div>

                  {it.note && (
                    <p className="mt-2 inline-flex items-start gap-1 text-sm text-muted">
                      <StickyNote size={13} className="mt-0.5 shrink-0" /> {it.note}
                    </p>
                  )}

                  {it.url && (
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-sm text-felt hover:underline"
                    >
                      <ExternalLink size={14} /> Zobacz
                    </a>
                  )}

                  <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-xs text-muted">
                    <Avatar username={it.added_by} size={18} />
                    <span>{displayNameOf(it.added_by)}</span>
                    <span>· {formatDate(it.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
