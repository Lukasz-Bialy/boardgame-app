"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Dices,
  History,
  Vote,
  CalendarDays,
  Heart,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Logo, Avatar } from "@/components/ui";
import type { Session } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Pulpit", icon: LayoutDashboard },
  { href: "/games", label: "Kolekcja gier", icon: Dices },
  { href: "/history", label: "Moja historia", icon: History },
  { href: "/polls", label: "Ankiety", icon: Vote },
  { href: "/calendar", label: "Kalendarz", icon: CalendarDays },
  { href: "/wishlist", label: "Wishlista", icon: Heart },
];

export default function Nav({ session }: { session: Session }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const links = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active ? "bg-felt/15 text-felt" : "text-muted hover:bg-panel2 hover:text-cream"
            }`}
          >
            <Icon size={18} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Górny pasek (mobile) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-ink/80 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 font-display text-lg font-bold">
          <Logo /> Wieczór gier
        </Link>
        <button className="btn-ghost px-2.5 py-2" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      {open && (
        <div className="border-b border-line bg-panel p-4 md:hidden">
          {links}
          <button onClick={logout} className="btn-ghost mt-3 w-full">
            <LogOut size={16} /> Wyloguj
          </button>
        </div>
      )}

      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-panel/60 p-4 md:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2.5 px-2 font-display text-xl font-bold">
          <Logo /> Wieczór gier
        </Link>
        {links}
        <div className="mt-auto border-t border-line pt-4">
          <div className="mb-3 flex items-center gap-2.5 px-1">
            <Avatar username={session.username} size={34} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-cream">{session.displayName}</div>
              <div className="text-xs text-muted">
                {session.role === "admin" ? "Administrator" : "Gracz"}
              </div>
            </div>
          </div>
          <button onClick={logout} className="btn-ghost w-full">
            <LogOut size={16} /> Wyloguj
          </button>
        </div>
      </aside>
    </>
  );
}
