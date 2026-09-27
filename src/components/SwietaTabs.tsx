"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift } from "lucide-react";

const TABS = [{ href: "/swieta/prezenty", label: "Prezenty", icon: Gift }];

export default function SwietaTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 rounded-xl border border-line bg-panel2 p-1 w-fit">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              active ? "bg-panel shadow-sm text-cream" : "text-muted hover:text-cream"
            }`}
          >
            <Icon size={15} /> {label}
          </Link>
        );
      })}
    </div>
  );
}
