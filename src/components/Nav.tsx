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
  Shuffle,
  UtensilsCrossed,
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
  { href: "/draw", label: "Losowanie", icon: Shuffle },
  { href: "/kebab", label: "Kącik kebabowy", icon: UtensilsCrossed },
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
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-all border-l-[3px] ${
              active
                ? "border-felt bg-felt/[0.09] text-felt pl-[10px] pr-3"
                : "border-transparent px-3 text-muted hover:bg-panel2/50 hover:text-cream"
            }`}
          >
            <Icon size={17} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Górny pasek (mobile) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line/50 bg-surface/90 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 font-display text-lg font-bold">
          <Logo /> Wieczór gier
        </Link>
        <button className="btn-ghost px-2.5 py-2" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      {open && (
        <div className="border-b border-line bg-surface p-4 md:hidden">
          {links}
          <button onClick={logout} className="btn-ghost mt-3 w-full">
            <LogOut size={16} /> Wyloguj
          </button>
        </div>
      )}

      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line/50 bg-surface p-4 md:flex">
        <Link
          href="/dashboard"
          className="mb-7 flex items-center gap-2.5 px-2 font-display text-[1.1rem] font-extrabold tracking-tight"
        >
          <Logo /> Wieczór gier
        </Link>

        {links}

        <div className="mt-auto pt-4">
          <div className="rounded-xl border border-line/50 bg-panel/40 p-3 mb-2">
            <div className="flex items-center gap-2.5">
              <Avatar username={session.username} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-cream">{session.displayName}</div>
                <div className="text-xs text-muted">
                  {session.role === "admin" ? "Administrator" : "Gracz"}
                </div>
              </div>
            </div>
          </div>
          <button onClick={logout} className="btn-ghost w-full text-xs py-1.5">
            <LogOut size={14} /> Wyloguj się
          </button>
        </div>
      </aside>
    </>
  );
}
