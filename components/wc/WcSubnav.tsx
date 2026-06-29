"use client";

import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface TabDef {
  href: string;
  label: string;
  exact?: boolean;
}

const TABS: readonly TabDef[] = [
  { href: "/wc", label: "Home", exact: true },
  { href: "/wc/groups", label: "Groups" },
  { href: "/wc/matches", label: "Matches" },
  { href: "/wc/bracket", label: "Bracket" },
  { href: "/wc/boot", label: "Golden Boot" },
  { href: "/wc/props", label: "Specials" },
];

export function WcSubnav() {
  const pathname = usePathname();
  return (
    <nav className="wc-tabs" aria-label="World Cup sections">
      <div
        className="inner"
        style={{ maxWidth: "var(--maxw)", margin: "0 auto", padding: "0 28px" }}
      >
        {TABS.map((t) => {
          const active = t.exact
            ? pathname === t.href
            : pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <Link key={t.href} href={t.href} className={cn(active && "active")}>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
